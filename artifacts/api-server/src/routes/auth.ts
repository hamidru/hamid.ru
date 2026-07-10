import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth, generateToken } from "../middlewares/auth";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "حساب کاربری شما غیرفعال است" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    return;
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id));
  if (!row) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    department: row.department,
    email: row.email,
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ success: true, message: "خروج موفق" });
});

export default router;
