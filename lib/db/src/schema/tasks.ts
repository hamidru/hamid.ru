import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("new"),
  deadline: date("deadline", { mode: "string" }),
  project: text("project"),
  department: text("department"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const taskAssignmentsTable = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
});

export const taskChecklistTable = pgTable("task_checklist", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  text: text("text").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const taskMessagesTable = pgTable("task_messages", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Task = typeof tasksTable.$inferSelect;
export type TaskAssignment = typeof taskAssignmentsTable.$inferSelect;
export type TaskChecklist = typeof taskChecklistTable.$inferSelect;
export type TaskMessage = typeof taskMessagesTable.$inferSelect;
