import { Hono } from "hono";
import db from "~/db";
import { eventRegistration } from "~/db/schema/events";
import { asc } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";

export const registrationsListRouter = new Hono();

registrationsListRouter.get("/:id/registrations", requireAuth, async (c) => {
    const id = c.req.param("id");
    if (!id) return c.body(null, 400);

    const items = await db.query.eventRegistration.findMany({
        where: (r, { eq }) => eq(r.eventId, id),
        orderBy: [asc(eventRegistration.waitlistPosition)],
    });

    return c.json({ items });
});
