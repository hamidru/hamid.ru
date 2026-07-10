import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CheckInBody, CheckOutBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

function toAttendanceDto(
  row: typeof attendanceTable.$inferSelect,
  userName: string,
) {
  const workHours =
    row.checkInTime && row.checkOutTime
      ? (row.checkOutTime.getTime() - row.checkInTime.getTime()) / 3600000
      : null;
  return {
    id: row.id,
    userId: row.userId,
    userName,
    date: row.date,
    checkInTime: row.checkInTime?.toISOString() ?? null,
    checkInLat: row.checkInLat,
    checkInLng: row.checkInLng,
    checkOutTime: row.checkOutTime?.toISOString() ?? null,
    checkOutLat: row.checkOutLat,
    checkOutLng: row.checkOutLng,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    workHours,
  };
}

router.get("/attendance/today", requireAuth, async (req, res): Promise<void> => {
  const today = getTodayDate();
  const [record] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.userId, req.user!.id),
        eq(attendanceTable.date, today),
      ),
    );

  if (!record) {
    res.json({
      id: 0,
      userId: req.user!.id,
      userName: req.user!.fullName,
      date: today,
      checkInTime: null,
      checkInLat: null,
      checkInLng: null,
      checkOutTime: null,
      checkOutLat: null,
      checkOutLng: null,
      isLate: false,
      isEarlyLeave: false,
      workHours: null,
    });
    return;
  }

  res.json(toAttendanceDto(record, req.user!.fullName));
});

router.post("/attendance/check-in", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = getTodayDate();
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.userId, req.user!.id),
        eq(attendanceTable.date, today),
      ),
    );

  if (existing?.checkInTime) {
    res.status(400).json({ error: "شما قبلاً ورود ثبت کرده‌اید" });
    return;
  }

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const isLate = hours > 8 || (hours === 8 && minutes > 5);

  const [record] = await db
    .insert(attendanceTable)
    .values({
      userId: req.user!.id,
      date: today,
      checkInTime: now,
      checkInLat: parsed.data.latitude,
      checkInLng: parsed.data.longitude,
      checkInDevice: parsed.data.deviceInfo ?? null,
      isLate,
    })
    .returning();

  if (isLate) {
    await db.insert(notificationsTable).values({
      userId: req.user!.id,
      title: "تأخیر ثبت شد",
      body: `ورود شما با تأخیر در ساعت ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} ثبت شد`,
      type: "attendance",
      referenceId: record!.id,
      referenceType: "attendance",
    });
  }

  res.json(toAttendanceDto(record!, req.user!.fullName));
});

router.post("/attendance/check-out", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckOutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = getTodayDate();
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.userId, req.user!.id),
        eq(attendanceTable.date, today),
      ),
    );

  if (!existing || !existing.checkInTime) {
    res.status(400).json({ error: "ابتدا باید ورود ثبت کنید" });
    return;
  }

  if (existing.checkOutTime) {
    res.status(400).json({ error: "شما قبلاً خروج ثبت کرده‌اید" });
    return;
  }

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const isEarlyLeave = hours < 16 || (hours === 15 && minutes < 55);

  const [record] = await db
    .update(attendanceTable)
    .set({
      checkOutTime: now,
      checkOutLat: parsed.data.latitude,
      checkOutLng: parsed.data.longitude,
      isEarlyLeave,
    })
    .where(eq(attendanceTable.id, existing.id))
    .returning();

  res.json(toAttendanceDto(record!, req.user!.fullName));
});

router.get("/attendance", requireAuth, async (req, res): Promise<void> => {
  const { userId, month } = req.query as { userId?: string; month?: string };
  const MANAGER_ROLES = ["admin", "special_manager", "manager", "hr"];
  const isManager = MANAGER_ROLES.includes(req.user!.role);

  const targetUserId = isManager && userId ? parseInt(userId, 10) : req.user!.id;

  let records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.userId, targetUserId))
    .orderBy(desc(attendanceTable.date));

  if (month) {
    records = records.filter((r) => r.date.startsWith(month));
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId));

  res.json(records.map((r) => toAttendanceDto(r, user?.fullName ?? "نامشخص")));
});

export default router;
