import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, leaveBalanceTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(usersTable);

    if (Number(userCount) > 0) return;

    logger.info("Seeding initial admin user...");
    const passwordHash = await bcrypt.hash("Admin@1234", 10);
    const [admin] = await db
      .insert(usersTable)
      .values({
        username: "admin",
        passwordHash,
        fullName: "حمید رومیانی",
        role: "admin",
        isActive: true,
      })
      .returning();

    if (admin) {
      await db.insert(leaveBalanceTable).values({
        userId: admin.id,
        year: new Date().getFullYear(),
        totalDays: 30,
        usedDays: 0,
      });
    }

    logger.info(
      "Admin user created. username=admin password=Admin@1234 — please change on first login.",
    );
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
