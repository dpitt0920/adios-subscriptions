// The to-do agent: Claude with tools over the signed-in user's tasks.
//
// Runs on the Messages API tool runner (the SDK drives the
// call -> run tools -> call loop). Each tool is bound to one userId, so the
// model can only ever see and change that user's tasks.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ToolError } from "@anthropic-ai/sdk/lib/tools/ToolError";
import { z } from "zod";
import {
  createTasks,
  dateString,
  deleteTask,
  listCompletedTasks,
  listTasks,
  setPlan,
  timeString,
  TaskNotFoundError,
  updateTask,
  type Task,
} from "./tasks.js";

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ITERATIONS = 12;

const client = new Anthropic();

// Kept byte-stable so it caches; per-request context (date, time zone) goes
// in the latest user message instead.
const SYSTEM_PROMPT = `You are the assistant inside a to-do app. You manage the user's tasks with the tools provided and keep replies short: the app shows the task list, so confirm what you did in a sentence or two instead of repeating every field.

What you do:
- Capture: turn plain language ("call mom tomorrow 5pm", "pay rent on the 1st, urgent") into tasks. Resolve relative dates against the current date given with each message. Put a time in due_time only when the user gave one. Map urgency words to priority (1 = urgent/high, 2 = medium, 3 = low, 4 = none, the default). Several things in one message become several tasks.
- Manage: complete, reschedule, rename, reprioritize or delete tasks when asked. Look up task ids with list_tasks first; never guess an id. If a request could match more than one task, ask which one.
- Break down: when asked to split a task into steps, create 3-7 concrete subtasks with parent_id set to that task, each starting with a verb, with a rough estimate_minutes when you can judge one.
- Plan the day: when asked for a plan, list open tasks, pick what fits the day (overdue and due-today first, then high priority, then quick wins; assume about 6 hours of focused time unless told otherwise), save it with set_daily_plan in the order to do them, and reply with the ordered plan and a one-line reason for anything important left out.

Delete only when the user clearly asked to delete or remove; "done" or "finished" means complete. Don't invent tasks the user didn't ask for, except subtasks when breaking a task down.`;

function compactTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    ...(t.parentId ? { parent_id: t.parentId } : {}),
    ...(t.notes ? { notes: t.notes } : {}),
    priority: t.priority,
    ...(t.dueDate ? { due_date: t.dueDate } : {}),
    ...(t.dueTime ? { due_time: t.dueTime } : {}),
    ...(t.estimateMinutes ? { estimate_minutes: t.estimateMinutes } : {}),
    ...(t.plannedDate
      ? { planned_date: t.plannedDate, plan_order: t.planOrder }
      : {}),
    completed: t.completed,
  };
}

async function withNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TaskNotFoundError) {
      throw new ToolError(
        `${err.message}. Call list_tasks to get current ids.`
      );
    }
    throw err;
  }
}

const newTaskFields = z.object({
  title: z.string().min(1).max(500).describe("Short, actionable title"),
  notes: z.string().max(5000).optional().describe("Extra details, if any"),
  priority: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe("1 = high, 2 = medium, 3 = low, 4 = none (default)"),
  due_date: dateString.optional().describe("YYYY-MM-DD"),
  due_time: timeString.optional().describe("24h HH:MM, only if the user gave a time"),
  estimate_minutes: z.number().int().min(1).max(1440).optional(),
  parent_id: z
    .string()
    .uuid()
    .optional()
    .describe("Id of the parent task, to create a subtask"),
});

function buildTools(userId: string, changed: Set<string>) {
  return [
    betaZodTool({
      name: "list_tasks",
      description:
        "List the user's tasks: all open tasks plus those completed in the last 7 days. Set include_all_completed to also get older completed tasks.",
      inputSchema: z.object({
        include_all_completed: z.boolean().optional(),
      }),
      run: async ({ include_all_completed }) => {
        const open = await listTasks(userId);
        const all = include_all_completed
          ? [
              ...open,
              ...(await listCompletedTasks(userId)).filter(
                (t) => !open.some((o) => o.id === t.id)
              ),
            ]
          : open;
        return JSON.stringify(all.map(compactTask));
      },
    }),
    betaZodTool({
      name: "create_tasks",
      description:
        "Create one or more tasks. Use parent_id to add subtasks under an existing task.",
      inputSchema: z.object({ tasks: z.array(newTaskFields).min(1).max(50) }),
      run: async ({ tasks }) =>
        withNotFound(async () => {
          const created = await createTasks(
            userId,
            tasks.map((t) => ({
              title: t.title,
              notes: t.notes,
              priority: t.priority,
              dueDate: t.due_date,
              dueTime: t.due_time,
              estimateMinutes: t.estimate_minutes,
              parentId: t.parent_id,
            }))
          );
          created.forEach((t) => changed.add(t.id));
          return JSON.stringify(created.map(compactTask));
        }),
    }),
    betaZodTool({
      name: "update_task",
      description:
        "Change a task: title, notes, priority, due date/time, estimate, or completion. Pass null to clear due_date, due_time, notes or estimate_minutes.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        notes: z.string().max(5000).nullable().optional(),
        priority: z.number().int().min(1).max(4).optional(),
        due_date: dateString.nullable().optional(),
        due_time: timeString.nullable().optional(),
        estimate_minutes: z.number().int().min(1).max(1440).nullable().optional(),
        completed: z.boolean().optional(),
      }),
      run: async ({ id, due_date, due_time, estimate_minutes, ...rest }) =>
        withNotFound(async () => {
          const task = await updateTask(userId, id, {
            ...rest,
            dueDate: due_date,
            dueTime: due_time,
            estimateMinutes: estimate_minutes,
          });
          changed.add(task.id);
          return JSON.stringify(compactTask(task));
        }),
    }),
    betaZodTool({
      name: "delete_task",
      description:
        "Permanently delete a task and its subtasks. Only when the user asked to delete or remove it.",
      inputSchema: z.object({ id: z.string().uuid() }),
      run: async ({ id }) =>
        withNotFound(async () => {
          await deleteTask(userId, id);
          changed.add(id);
          return "Deleted.";
        }),
    }),
    betaZodTool({
      name: "set_daily_plan",
      description:
        "Save the plan for a day as an ordered list of task ids (first = do first). Replaces any existing plan for that date.",
      inputSchema: z.object({
        date: dateString.describe("YYYY-MM-DD"),
        task_ids: z.array(z.string().uuid()).max(50),
      }),
      run: async ({ date, task_ids }) =>
        withNotFound(async () => {
          const planned = await setPlan(userId, date, task_ids);
          planned.forEach((t) => changed.add(t.id));
          return `Plan saved for ${date} with ${planned.length} task(s).`;
        }),
    }),
  ];
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AgentResult = {
  reply: string;
  changedTaskIds: string[];
  refused: boolean;
};

export async function runAgent(opts: {
  userId: string;
  history: ChatTurn[];
  message: string;
  /** The user's local date/time, e.g. "Wednesday 2026-11-25 14:05". */
  localNow: string;
  timeZone: string;
}): Promise<AgentResult> {
  const changed = new Set<string>();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...opts.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    {
      role: "user",
      content: `[Now: ${opts.localNow} (${opts.timeZone})]\n\n${opts.message}`,
    },
  ];

  const finalMessage = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    max_iterations: MAX_TOOL_ITERATIONS,
    output_config: { effort: "medium" },
    // Re-run on the model's default fallback if a request is declined.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: SYSTEM_PROMPT,
    tools: buildTools(opts.userId, changed),
    messages,
  });

  const changedTaskIds = [...changed];

  if (finalMessage.stop_reason === "refusal") {
    return {
      reply: "Sorry, I can't help with that one.",
      changedTaskIds,
      refused: true,
    };
  }

  const reply = finalMessage.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    reply: reply || (changedTaskIds.length ? "Done." : "Okay."),
    changedTaskIds,
    refused: false,
  };
}
