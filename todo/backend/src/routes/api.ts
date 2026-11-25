import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import agentRoutes from "./agent.js";
import googleRoutes from "./google.js";
import tasksRoutes from "./tasks.js";

const updateMeSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  isOnboardingComplete: z.boolean().optional(),
  // "How I like things": free text the agent reads before every task.
  preferences: z.string().max(10000).nullable().optional(),
});

const api = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .post("/signin", async (c) => {
    const authUser = c.get("user");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });

    if (existingUser) {
      return c.json(existingUser);
    }

    const [newUser] = await db
      .insert(users)
      .values({
        id: authUser.id,
        email: authUser.email!,
        fullName: authUser.user_metadata?.full_name ?? null,
      })
      .returning();

    return c.json(newUser);
  })
  .route("/tasks", tasksRoutes)
  .route("/agent", agentRoutes)
  .route("/google", googleRoutes)
  .get("/me", async (c) => {
    const authUser = c.get("user");

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });

    return c.json({
      id: authUser.id,
      email: authUser.email,
      fullName: dbUser?.fullName ?? null,
      isOnboardingComplete: dbUser?.isOnboardingComplete ?? false,
      preferences: dbUser?.preferences ?? null,
    });
  })
  .patch("/me", zValidator("json", updateMeSchema), async (c) => {
    const authUser = c.get("user");
    const { preferences, ...rest } = c.req.valid("json");
    const updates = {
      ...rest,
      ...(preferences !== undefined
        ? { preferences: preferences?.trim() ? preferences : null }
        : {}),
    };

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, authUser.id))
      .returning();

    return c.json({
      id: authUser.id,
      email: authUser.email,
      fullName: updated?.fullName ?? null,
      isOnboardingComplete: updated?.isOnboardingComplete ?? false,
      preferences: updated?.preferences ?? null,
    });
  })
  .get("/health", (c) => {
    return c.json({ status: "ok", authenticated: true });
  });

export default api;
