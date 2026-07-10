import { Router } from "express";
import { db } from "@workspace/db";
import {
  leaveRequestsTable,
  leaveBalanceTable,
  usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateLeaveRequestBody,
  UpdateLeaveStatusBody,
  UpdateLeaveStatusParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const APPROVER_ROLES = ["admin", "manager", "special_manager", "hr"];

function toLeaveDto(
  row: typeof leaveRequestsTable.$inferSelect,
  userName: string,
) {
  return {
    id: row.id,
    userId: row.userId,
    userName,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    hours: row.hours,
    reason: row.reason,
    status: row.status,
    managerNote: row.managerNote,
    fileUrl: row.fileUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/leave/balance", requireAuth, async (req, res): Promise<void> => {
  const year = new Date().getFullYear();
  let [balance] = await db
    .select()
    .from(leaveBalanceTable)
    .where(eq(leaveBalanceTable.userId, req.user!.id));

  if (!balance) {
    const [created] = await db
      .insert(leaveBalanceTable)
      .values({ userId: req.user!.id, year, totalDays: 30, usedDays: 0 })
      .returning();
    balance = created!;
  }

  const pendingLeaves = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, req.user!.id),
        eq(leaveRequestsTable.status, "pending"),
      ),
    );

  const pendingDays = pendingLeaves.reduce((sum, l) => {
    if (l.type === "hourly") return sum + (l.hours ?? 0) / 8;
    if (l.endDate) {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const diff = (end.getTime() - start.getTime()) / 86400000 + 1;
      return sum + diff;
    }
    return sum + 1;
  }, 0);

  res.json({
    totalDays: balance.totalDays,
    usedDays: balance.usedDays,
    remainingDays: Math.max(0, balance.totalDays - balance.usedDays),
    pendingDays,
  });
});

router.get("/leave", requireAuth, async (req, res): Promise<void> => {
  const { status, userId } = req.query as { status?: string; userId?: string };
  const isManager = APPROVER_ROLES.includes(req.user!.role);

  let requests = isManager
    ? await db.select().from(leaveRequestsTable).orderBy(desc(leaveRequestsTable.createdAt))
    : await db
        .select()
        .from(leaveRequestsTable)
        .where(eq(leaveRequestsTable.userId, req.user!.id))
        .orderBy(desc(leaveRequestsTable.createdAt));

  if (status) requests = requests.filter((r) => r.status === status);
  if (isManager && userId) requests = requests.filter((r) => r.userId === parseInt(userId, 10));

  const userIds = [...new Set(requests.map((r) => r.userId))];
  const users =
    userIds.length > 0
      ? await db
          .select()
          .from(usersTable)
          .then((all) => all.filter((u) => userIds.includes(u.id)))
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  res.json(requests.map((r) => toLeaveDto(r, userMap.get(r.userId) ?? "نامشخص")));
});

router.post("/leave", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeaveRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, startDate, endDate, hours, reason, fileUrl } = parsed.data;

  const [request] = await db
    .insert(leaveRequestsTable)
    .values({
      userId: req.user!.id,
      type,
      startDate,
      endDate: endDate ?? null,
      hours: hours ?? null,
      reason,
      fileUrl: fileUrl ?? null,
      status: "pending",
    })
    .returning();

  // Notify managers/HR
  const managers = await db
    .select()
    .from(usersTable)
    .then((all) =>
      all.filter((u) => APPROVER_ROLES.includes(u.role) && u.isActive && u.id !== req.user!.id),
    );

  for (const manager of managers.slice(0, 5)) {
    await db.insert(notificationsTable).values({
      userId: manager.id,
      title: "درخواست مرخصی جدید",
      body: `${req.user!.fullName} درخواست مرخصی ثبت کرد`,
      type: "leave",
      referenceId: request!.id,
      referenceType: "leave",
    });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id));
  res.status(201).json(toLeaveDto(request!, user?.fullName ?? "نامشخص"));
});

router.put(
  "/leave/:id/status",
  requireAuth,
  requireRole(...APPROVER_ROLES),
  async (req, res): Promise<void> => {
    const paramParsed = UpdateLeaveStatusParams.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateLeaveStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { status, managerNote } = parsed.data;

    const [existing] = await db
      .select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.id, paramParsed.data.id));

    if (!existing) {
      res.status(404).json({ error: "درخواست یافت نشد" });
      return;
    }

    if (existing.status !== "pending") {
      res.status(400).json({ error: "این درخواست قبلاً بررسی شده است" });
      return;
    }

    const [updated] = await db
      .update(leaveRequestsTable)
      .set({ status, managerNote: managerNote ?? null, managerId: req.user!.id })
      .where(eq(leaveRequestsTable.id, paramParsed.data.id))
      .returning();

    if (status === "approved") {
      const days =
        existing.type === "hourly"
          ? (existing.hours ?? 0) / 8
          : existing.endDate
            ? (new Date(existing.endDate).getTime() - new Date(existing.startDate).getTime()) /
                86400000 +
              1
            : 1;

      const [bal] = await db
        .select()
        .from(leaveBalanceTable)
        .where(eq(leaveBalanceTable.userId, existing.userId));
      if (bal) {
        await db
          .update(leaveBalanceTable)
          .set({ usedDays: bal.usedDays + days })
          .where(eq(leaveBalanceTable.userId, existing.userId));
      }
    }

    const statusLabel = status === "approved" ? "تایید شد" : "رد شد";
    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: `مرخصی ${statusLabel}`,
      body: `درخواست مرخصی شما ${statusLabel}${managerNote ? `: ${managerNote}` : ""}`,
      type: "leave",
      referenceId: existing.id,
      referenceType: "leave",
    });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, existing.userId));
    res.json(toLeaveDto(updated!, user?.fullName ?? "نامشخص"));
  },
);

export default router;
