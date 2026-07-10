import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  hours: doublePrecision("hours"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  managerNote: text("manager_note"),
  fileUrl: text("file_url"),
  managerId: integer("manager_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const leaveBalanceTable = pgTable("leave_balance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  year: integer("year").notNull(),
  totalDays: doublePrecision("total_days").notNull().default(0),
  usedDays: doublePrecision("used_days").notNull().default(0),
});

export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type LeaveBalanceRecord = typeof leaveBalanceTable.$inferSelect;
