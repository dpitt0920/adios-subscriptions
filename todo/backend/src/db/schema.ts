import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  date,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  isOnboardingComplete: boolean("is_onboarding_complete")
    .default(false)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Tasks
//
// A task can have subtasks (one level deep in the UI, via `parentId`).
// `dueDate`/`dueTime` are stored as the user's local calendar date and wall-clock
// time, so they don't shift when the user travels across time zones.
// `plannedDate`/`planOrder` hold the agent's (or user's) plan for a given day.
// Priority: 1 = highest, 4 = none.
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: integer("priority").notNull().default(4),
    dueDate: date("due_date"),
    dueTime: text("due_time"),
    estimateMinutes: integer("estimate_minutes"),
    plannedDate: date("planned_date"),
    planOrder: integer("plan_order"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("tasks_user_idx").on(t.userId)]
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
}));
