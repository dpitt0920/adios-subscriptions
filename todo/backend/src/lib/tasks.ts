// Task data access shared by the REST routes and the agent's tools.
// Every function is scoped to a userId so neither path can touch another
// user's tasks.

import { and, asc, eq, inArray, isNull, isNotNull, gte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { tasks } from "../db/schema.js";

export type TaskRow = typeof tasks.$inferSelect;

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM");

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(5000).nullish(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: dateString.nullish(),
  dueTime: timeString.nullish(),
  estimateMinutes: z.number().int().min(1).max(24 * 60).nullish(),
  parentId: z.string().uuid().nullish(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskPatchSchema = taskInputSchema
  .omit({ parentId: true })
  .partial()
  .extend({
    completed: z.boolean().optional(),
    plannedDate: dateString.nullish(),
    planOrder: z.number().int().min(0).nullish(),
  });
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export function serializeTask(task: TaskRow) {
  return {
    id: task.id,
    parentId: task.parentId,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    estimateMinutes: task.estimateMinutes,
    plannedDate: task.plannedDate,
    planOrder: task.planOrder,
    position: task.position,
    completed: task.completedAt != null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
export type Task = ReturnType<typeof serializeTask>;

/** Open tasks plus anything completed in the last 7 days. */
export async function listTasks(userId: string): Promise<Task[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        or(isNull(tasks.completedAt), gte(tasks.completedAt, weekAgo))
      )
    )
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  return rows.map(serializeTask);
}

export async function listCompletedTasks(userId: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.completedAt)))
    .orderBy(asc(tasks.completedAt));
  return rows.map(serializeTask);
}

async function assertOwned(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  const unique = [...new Set(ids)];
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, unique)));
  if (rows.length !== unique.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = unique.filter((id) => !found.has(id));
    throw new TaskNotFoundError(missing);
  }
}

export class TaskNotFoundError extends Error {
  constructor(public ids: string[]) {
    super(`Task(s) not found: ${ids.join(", ")}`);
  }
}

export async function createTasks(
  userId: string,
  inputs: TaskInput[]
): Promise<Task[]> {
  if (inputs.length === 0) return [];
  await assertOwned(
    userId,
    inputs.flatMap((i) => (i.parentId ? [i.parentId] : []))
  );
  const rows = await db
    .insert(tasks)
    .values(
      inputs.map((input, i) => ({
        userId,
        title: input.title,
        notes: input.notes ?? null,
        priority: input.priority ?? 4,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        estimateMinutes: input.estimateMinutes ?? null,
        parentId: input.parentId ?? null,
        position: i,
      }))
    )
    .returning();
  return rows.map(serializeTask);
}

export async function updateTask(
  userId: string,
  id: string,
  patch: TaskPatch
): Promise<Task> {
  const { completed, ...rest } = patch;
  const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }
  if (completed !== undefined) {
    updates.completedAt = completed ? new Date() : null;
  }
  const [row] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();
  if (!row) throw new TaskNotFoundError([id]);
  return serializeTask(row);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  if (deleted.length === 0) throw new TaskNotFoundError([id]);
}

/**
 * Replace the plan for `date` with `orderedIds` (in order). Tasks previously
 * planned for that date but not in the list are unplanned.
 */
export async function setPlan(
  userId: string,
  date: string,
  orderedIds: string[]
): Promise<Task[]> {
  await assertOwned(userId, orderedIds);
  return db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({ plannedDate: null, planOrder: null, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.plannedDate, date)));
    const updated: Task[] = [];
    for (const [order, id] of orderedIds.entries()) {
      const [row] = await tx
        .update(tasks)
        .set({ plannedDate: date, planOrder: order, updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .returning();
      if (row) updated.push(serializeTask(row));
    }
    return updated;
  });
}
