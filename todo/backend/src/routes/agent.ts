import Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { runAgent } from "../lib/agent.js";
import type { AppEnv } from "../types.js";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  // Prior text turns of this chat, oldest first. The client keeps the
  // conversation; the server is stateless.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .max(40)
    .default([]),
  localNow: z.string().min(1).max(100),
  timeZone: z.string().min(1).max(100),
});

const agentRoutes = new Hono<AppEnv>().post(
  "/chat",
  zValidator("json", chatSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const result = await runAgent({
        userId: c.get("user").id,
        ...body,
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return c.json({ error: "The assistant is busy, try again shortly." }, 503);
      }
      if (err instanceof Anthropic.APIError) {
        console.error("[agent] Claude API error", err.status, err.message);
        return c.json({ error: "The assistant is unavailable right now." }, 502);
      }
      throw err;
    }
  }
);

export default agentRoutes;
