import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, leaveBalanceTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody, UpdateUserParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const MANAGER_ROLES = ["admin", "special_manager", "manager", "hr"];

function toUserDto(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get(
  "/users",
  requireAuth,
  requireRole(...MANAGER_ROLES),
  async (_req, res): Promise<void> => {
    const users = await db.select().from(usersTable).orderBy(usersTable.fullName);
    res.json(users.map(toUserDto));
  },
);

router.post(
  "/users",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { username, password, fullName, role, department, email, phone } =
      parsed.data;

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existing) {
      res.status(400).json({ error: "این نام کاربری قبلاً ثبت شده است" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash,
        fullName,
        role,
        department: department ?? null,
        email: email ?? null,
        phone: phone ?? null,
        isActive: true,
      })
      .returning();

    if (user) {
      await db.insert(leaveBalanceTable).values({
        userId: user.id,
        year: new Date().getFullYear(),
        totalDays: 30,
        usedDays: 0,
      });
    }

    res.status(201).json(toUserDto(user!));
  },
);

router.put(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const paramParsed = UpdateUserParams.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { password, fullName, role, department, email, phone, isActive } =
      parsed.data;

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName != null) updates.fullName = fullName;
    if (role != null) updates.role = role;
    if (department !== undefined) updates.department = department ?? null;
    if (email !== undefined) updates.email = email ?? null;
    if (phone !== undefined) updates.phone = phone ?? null;
    if (isActive != null) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, paramParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "کاربر یافت نشد" });
      return;
    }

    res.json(toUserDto(updated));
  },
);

router.delete(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId!, 10);

    if (req.user?.id === id) {
      res.status(400).json({ error: "نمی‌توانید حساب خود را حذف کنید" });
      return;
    }

    await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
    res.json({ success: true });
  },
);

export default router;
