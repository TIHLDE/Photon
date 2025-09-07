import { Hono } from "hono";
import db from "~/db";
import { event } from "~/db/schema/events";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";

export const removeRouter = new Hono();

removeRouter.delete("/:id", requireAuth, async (c) => {
    const id = c.req.param("id");
    if (!id) return c.body(null, 400);

    const res = await db.delete(event).where(eq(event.id, id)).returning();
    if (!res[0]) return c.body(null, 404);

    return c.body(null, 204);
});
