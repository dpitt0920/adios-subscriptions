import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createTasks,
  dateString,
  deleteTask,
  listTasks,
  setPlan,
  taskInputSchema,
  taskPatchSchema,
  TaskNotFoundError,
  updateTask,
} from "../lib/tasks.js";
import type { AppEnv } from "../types.js";

const idParam = z.object({ id: z.string().uuid() });

const planSchema = z.object({
  date: dateString,
  taskIds: z.array(z.string().uuid()).max(100),
});

const tasksRoutes = new Hono<AppEnv>()
  .onError((err, c) => {
    if (err instanceof TaskNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  })
  .get("/", async (c) => {
    return c.json(await listTasks(c.get("user").id));
  })
  .post("/", zValidator("json", taskInputSchema), async (c) => {
    const [task] = await createTasks(c.get("user").id, [c.req.valid("json")]);
    return c.json(task, 201);
  })
  .patch(
    "/:id",
    zValidator("param", idParam),
    zValidator("json", taskPatchSchema),
    async (c) => {
      const task = await updateTask(
        c.get("user").id,
        c.req.valid("param").id,
        c.req.valid("json")
      );
      return c.json(task);
    }
  )
  .delete("/:id", zValidator("param", idParam), async (c) => {
    await deleteTask(c.get("user").id, c.req.valid("param").id);
    return c.json({ ok: true });
  })
  .put("/plan", zValidator("json", planSchema), async (c) => {
    const { date, taskIds } = c.req.valid("json");
    return c.json(await setPlan(c.get("user").id, date, taskIds));
  });

export default tasksRoutes;
