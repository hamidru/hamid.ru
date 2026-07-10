import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskAssignmentsTable,
  taskChecklistTable,
  taskMessagesTable,
  usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, inArray, and, desc } from "drizzle-orm";
import {
  CreateTaskBody,
  UpdateTaskStatusBody,
  SendTaskMessageBody,
  GetTaskParams,
  UpdateTaskStatusParams,
  DeleteTaskParams,
  GetTaskMessagesParams,
  SendTaskMessageParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const MANAGER_ROLES = ["admin", "special_manager", "manager"];

async function buildTaskDto(task: typeof tasksTable.$inferSelect) {
  const assignments = await db
    .select({ userId: taskAssignmentsTable.userId })
    .from(taskAssignmentsTable)
    .where(eq(taskAssignmentsTable.taskId, task.id));

  const assigneeIds = assignments.map((a) => a.userId);
  let assignees: { id: number; fullName: string; role: string; department: string | null }[] = [];
  if (assigneeIds.length > 0) {
    const users = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, assigneeIds));
    assignees = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      department: u.department,
    }));
  }

  const [creator] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, task.createdBy));

  const checklists = await db
    .select()
    .from(taskChecklistTable)
    .where(eq(taskChecklistTable.taskId, task.id));
  const messages = await db
    .select({ id: taskMessagesTable.id })
    .from(taskMessagesTable)
    .where(eq(taskMessagesTable.taskId, task.id));

  const doneCnt = checklists.filter((c) => c.isDone).length;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    deadline: task.deadline,
    project: task.project,
    department: task.department,
    assignees,
    createdBy: creator
      ? { id: creator.id, fullName: creator.fullName, role: creator.role, department: creator.department }
      : { id: task.createdBy, fullName: "نامشخص", role: "unknown", department: null },
    checklistTotal: checklists.length,
    checklistDone: doneCnt,
    messageCount: messages.length,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { status, priority } = req.query as { status?: string; priority?: string };

  let tasks: (typeof tasksTable.$inferSelect)[] = [];

  if (MANAGER_ROLES.includes(user.role) || user.role === "hr") {
    const query = db.select().from(tasksTable).orderBy(desc(tasksTable.updatedAt));
    tasks = await query;
  } else {
    // Employee: only see assigned tasks
    const assignments = await db
      .select({ taskId: taskAssignmentsTable.taskId })
      .from(taskAssignmentsTable)
      .where(eq(taskAssignmentsTable.userId, user.id));
    const taskIds = assignments.map((a) => a.taskId);
    if (taskIds.length === 0) {
      res.json([]);
      return;
    }
    tasks = await db
      .select()
      .from(tasksTable)
      .where(inArray(tasksTable.id, taskIds))
      .orderBy(desc(tasksTable.updatedAt));
  }

  if (status) tasks = tasks.filter((t) => t.status === status);
  if (priority) tasks = tasks.filter((t) => t.priority === priority);

  const dtos = await Promise.all(tasks.map(buildTaskDto));
  res.json(dtos);
});

router.post(
  "/tasks",
  requireAuth,
  requireRole(...MANAGER_ROLES),
  async (req, res): Promise<void> => {
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { title, description, priority, deadline, project, department, assigneeIds, checklist } =
      parsed.data;

    const [task] = await db
      .insert(tasksTable)
      .values({
        title,
        description: description ?? null,
        priority,
        status: "sent",
        deadline: deadline ?? null,
        project: project ?? null,
        department: department ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    for (const userId of assigneeIds) {
      await db.insert(taskAssignmentsTable).values({ taskId: task!.id, userId });
    }

    if (checklist && checklist.length > 0) {
      for (let i = 0; i < checklist.length; i++) {
        await db.insert(taskChecklistTable).values({
          taskId: task!.id,
          text: checklist[i]!,
          sortOrder: i,
        });
      }
    }

    // Notify assignees
    for (const userId of assigneeIds) {
      await db.insert(notificationsTable).values({
        userId,
        title: "وظیفه جدید",
        body: `وظیفه "${title}" به شما محول شد`,
        type: "task",
        referenceId: task!.id,
        referenceType: "task",
      });
    }

    const dto = await buildTaskDto(task!);
    res.status(201).json(dto);
  },
);

async function canAccessTask(
  userId: number,
  role: string,
  taskId: number,
): Promise<boolean> {
  if (MANAGER_ROLES.includes(role) || role === "hr") return true;
  const [assignment] = await db
    .select()
    .from(taskAssignmentsTable)
    .where(
      and(
        eq(taskAssignmentsTable.taskId, taskId),
        eq(taskAssignmentsTable.userId, userId),
      ),
    );
  return !!assignment;
}

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const paramParsed = GetTaskParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, paramParsed.data.id));
  if (!task) {
    res.status(404).json({ error: "وظیفه یافت نشد" });
    return;
  }

  const allowed = await canAccessTask(req.user!.id, req.user!.role, task.id);
  if (!allowed) {
    res.status(403).json({ error: "دسترسی غیرمجاز" });
    return;
  }

  const checklists = await db
    .select()
    .from(taskChecklistTable)
    .where(eq(taskChecklistTable.taskId, task.id))
    .orderBy(taskChecklistTable.sortOrder);

  const dto = await buildTaskDto(task);
  res.json({
    ...dto,
    checklist: checklists.map((c) => ({
      id: c.id,
      text: c.text,
      isDone: c.isDone,
      sortOrder: c.sortOrder,
    })),
  });
});

router.delete("/tasks/:id", requireAuth, requireRole(...MANAGER_ROLES), async (req, res): Promise<void> => {
  const paramParsed = DeleteTaskParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(taskAssignmentsTable).where(eq(taskAssignmentsTable.taskId, paramParsed.data.id));
  await db.delete(taskChecklistTable).where(eq(taskChecklistTable.taskId, paramParsed.data.id));
  await db.delete(taskMessagesTable).where(eq(taskMessagesTable.taskId, paramParsed.data.id));
  await db.delete(tasksTable).where(eq(tasksTable.id, paramParsed.data.id));

  res.json({ success: true });
});

router.put("/tasks/:id/status", requireAuth, async (req, res): Promise<void> => {
  const paramParsed = UpdateTaskStatusParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTaskStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status } = parsed.data;
  const user = req.user!;

  const allowed = await canAccessTask(user.id, user.role, paramParsed.data.id);
  if (!allowed) {
    res.status(403).json({ error: "دسترسی غیرمجاز" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, paramParsed.data.id));
  if (!task) {
    res.status(404).json({ error: "وظیفه یافت نشد" });
    return;
  }

  // Validate status transitions
  const employeeStatuses = ["received", "in_progress", "in_review", "done"];
  const managerStatuses = ["sent", "revision", "approved", "closed"];

  if (!MANAGER_ROLES.includes(user.role)) {
    if (!employeeStatuses.includes(status)) {
      res.status(403).json({ error: "شما مجاز به تغییر این وضعیت نیستید" });
      return;
    }
  }

  const [updated] = await db
    .update(tasksTable)
    .set({ status })
    .where(eq(tasksTable.id, paramParsed.data.id))
    .returning();

  // Notify creator
  if (task.createdBy !== user.id) {
    await db.insert(notificationsTable).values({
      userId: task.createdBy,
      title: "تغییر وضعیت وظیفه",
      body: `وضعیت وظیفه "${task.title}" به "${status}" تغییر یافت`,
      type: "task",
      referenceId: task.id,
      referenceType: "task",
    });
  }

  const dto = await buildTaskDto(updated!);
  res.json(dto);
});

router.get("/tasks/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const paramParsed = GetTaskMessagesParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const allowed = await canAccessTask(req.user!.id, req.user!.role, paramParsed.data.id);
  if (!allowed) {
    res.status(403).json({ error: "دسترسی غیرمجاز" });
    return;
  }

  const messages = await db
    .select()
    .from(taskMessagesTable)
    .where(eq(taskMessagesTable.taskId, paramParsed.data.id))
    .orderBy(taskMessagesTable.createdAt);

  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  let senders: { id: number; fullName: string; role: string }[] = [];
  if (senderIds.length > 0) {
    const users = await db.select().from(usersTable).where(inArray(usersTable.id, senderIds));
    senders = users.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));
  }

  const senderMap = new Map(senders.map((s) => [s.id, s]));
  res.json(
    messages.map((m) => ({
      id: m.id,
      taskId: m.taskId,
      senderId: m.senderId,
      senderName: senderMap.get(m.senderId)?.fullName ?? "نامشخص",
      senderRole: senderMap.get(m.senderId)?.role ?? "unknown",
      content: m.content,
      fileUrl: m.fileUrl,
      fileType: m.fileType,
      fileName: m.fileName,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/tasks/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const paramParsed = SendTaskMessageParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const allowed = await canAccessTask(req.user!.id, req.user!.role, paramParsed.data.id);
  if (!allowed) {
    res.status(403).json({ error: "دسترسی غیرمجاز" });
    return;
  }

  const parsed = SendTaskMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, fileUrl, fileType, fileName } = parsed.data;
  const user = req.user!;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, paramParsed.data.id));
  if (!task) {
    res.status(404).json({ error: "وظیفه یافت نشد" });
    return;
  }

  const [message] = await db
    .insert(taskMessagesTable)
    .values({
      taskId: paramParsed.data.id,
      senderId: user.id,
      content,
      fileUrl: fileUrl ?? null,
      fileType: fileType ?? null,
      fileName: fileName ?? null,
    })
    .returning();

  // Notify other participants
  const assignments = await db
    .select({ userId: taskAssignmentsTable.userId })
    .from(taskAssignmentsTable)
    .where(eq(taskAssignmentsTable.taskId, paramParsed.data.id));
  const recipients = new Set([task.createdBy, ...assignments.map((a) => a.userId)]);
  recipients.delete(user.id);

  for (const userId of recipients) {
    await db.insert(notificationsTable).values({
      userId,
      title: "پیام جدید",
      body: `${user.fullName}: ${content.slice(0, 50)}`,
      type: "task",
      referenceId: task.id,
      referenceType: "task",
    });
  }

  res.status(201).json({
    id: message!.id,
    taskId: message!.taskId,
    senderId: user.id,
    senderName: user.fullName,
    senderRole: user.role,
    content: message!.content,
    fileUrl: message!.fileUrl,
    fileType: message!.fileType,
    fileName: message!.fileName,
    createdAt: message!.createdAt.toISOString(),
  });
});

export default router;
