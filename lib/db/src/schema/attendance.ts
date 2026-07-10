import {
  pgTable,
  serial,
  integer,
  timestamp,
  date,
  doublePrecision,
  boolean,
  text,
} from "drizzle-orm/pg-core";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  checkInTime: timestamp("check_in_time", { withTimezone: true }),
  checkInLat: doublePrecision("check_in_lat"),
  checkInLng: doublePrecision("check_in_lng"),
  checkInDevice: text("check_in_device"),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),
  checkOutLat: doublePrecision("check_out_lat"),
  checkOutLng: doublePrecision("check_out_lng"),
  isLate: boolean("is_late").notNull().default(false),
  isEarlyLeave: boolean("is_early_leave").notNull().default(false),
});

export type Attendance = typeof attendanceTable.$inferSelect;
