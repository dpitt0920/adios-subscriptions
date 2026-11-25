import "dotenv/config";
import { Hono } from "hono";
import { logger } from "hono/logger";
import api from "./routes/api.js";
import { googleCallbackRoutes } from "./routes/google.js";

const app = new Hono()
  .use("*", logger())
  .get("/", (c) => {
    return c.text("Hello World");
  })
  // Public: Google redirects the browser here, so no bearer token.
  .route("/google", googleCallbackRoutes)
  .route("/api", api);

export default app;

export type AppType = typeof app;
