import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskAssignmentsTable,
  attendanceTable,
  leaveRequestsTable,
  leaveBalanceTable,
  notificationsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const today = getTodayDate();
  const MANAGER_ROLES = ["admin", "special_manager", "manager", "hr"];

  // My attendance today
  const [todayAttendance] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(eq(attendanceTable.userId, user.id), eq(attendanceTable.date, today)),
    );

  // Leave balance
  let [balance] = await db
    .select()
    .from(leaveBalanceTable)
    .where(eq(leaveBalanceTable.userId, user.id));
  if (!balance) {
    [balance] = await db
      .insert(leaveBalanceTable)
      .values({ userId: user.id, year: new Date().getFullYear(), totalDays: 30, usedDays: 0 })
      .returning();
  }
  const leaveBalance = Math.max(0, (balance?.totalDays ?? 30) - (balance?.usedDays ?? 0));

  // Unread notifications
  const [{ value: unreadCount }] = await db
    .select({ value: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, user.id),
        eq(notificationsTable.isRead, false),
      ),
    );

  if (MANAGER_ROLES.includes(user.role)) {
    // Manager/admin dashboard
    const allTasks = await db.select().from(tasksTable);
    const todayTasks = allTasks.filter((t) => {
      const created = t.createdAt.toISOString().split("T")[0];
      return created === today;
    });
    const pendingTasks = allTasks.filter((t) =>
      ["sent", "received", "in_progress", "in_review"].includes(t.status),
    );
    const overdueTasks = allTasks.filter(
      (t) =>
        t.deadline &&
        t.deadline < today &&
        !["approved", "closed"].includes(t.status),
    );
    const completedTasks = allTasks.filter((t) =>
      ["approved", "closed"].includes(t.status),
    );

    const allAttendance = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));

    const allUsers = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
    const employeeCount = allUsers.filter((u) => !["admin"].includes(u.role)).length;
    const presentCount = allAttendance.filter((a) => a.checkInTime).length;
    const lateCount = allAttendance.filter((a) => a.isLate).length;

    const [{ value: pendingLeaveCount }] = await db
      .select({ value: count() })
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.status, "pending"));

    res.json({
      role: user.role,
      todayTasks: todayTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      completedTasks: completedTasks.length,
      presentToday: presentCount,
      absentToday: Math.max(0, employeeCount - presentCount),
      pendingLeaves: Number(pendingLeaveCount),
      todayLate: lateCount,
      myCheckIn: todayAttendance?.checkInTime?.toISOString() ?? null,
      myCheckOut: todayAttendance?.checkOutTime?.toISOString() ?? null,
      leaveBalance,
      unreadNotifications: Number(unreadCount),
      totalEmployees: employeeCount,
    });
  } else {
    // Employee dashboard
    const assignments = await db
      .select({ taskId: taskAssignmentsTable.taskId })
      .from(taskAssignmentsTable)
      .where(eq(taskAssignmentsTable.userId, user.id));
    const taskIds = assignments.map((a) => a.taskId);

    let myTasks: (typeof tasksTable.$inferSelect)[] = [];
    if (taskIds.length > 0) {
      myTasks = await db.select().from(tasksTable).where(inArray(tasksTable.id, taskIds));
    }

    const todayTasks = myTasks.filter((t) => {
      const created = t.createdAt.toISOString().split("T")[0];
      return created === today;
    });
    const pendingTasks = myTasks.filter((t) =>
      ["sent", "received", "in_progress", "in_review"].includes(t.status),
    );
    const overdueTasks = myTasks.filter(
      (t) =>
        t.deadline &&
        t.deadline < today &&
        !["approved", "closed"].includes(t.status),
    );
    const completedTasks = myTasks.filter((t) =>
      ["approved", "closed"].includes(t.status),
    );

    const [{ value: pendingLeaveCount }] = await db
      .select({ value: count() })
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.userId, user.id),
          eq(leaveRequestsTable.status, "pending"),
        ),
      );

    res.json({
      role: user.role,
      todayTasks: todayTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      completedTasks: completedTasks.length,
      presentToday: null,
      absentToday: null,
      pendingLeaves: Number(pendingLeaveCount),
      todayLate: null,
      myCheckIn: todayAttendance?.checkInTime?.toISOString() ?? null,
      myCheckOut: todayAttendance?.checkOutTime?.toISOString() ?? null,
      leaveBalance,
      unreadNotifications: Number(unreadCount),
      totalEmployees: null,
    });
  }
});

export default router;
