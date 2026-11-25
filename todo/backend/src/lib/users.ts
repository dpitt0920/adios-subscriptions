import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

/** The user's "How I like things" profile, or null if none is set. */
export async function getPreferences(userId: string): Promise<string | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const value = row?.preferences?.trim();
  return value ? value : null;
}
