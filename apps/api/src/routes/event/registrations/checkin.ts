// import { Hono } from "hono";
// import z from "zod";
// import { describeRoute, validator } from "hono-openapi";
// import db from "~/db";
// import { eventRegistration } from "~/db/schema/events";
// import { and, eq } from "drizzle-orm";
// import { requireAuth } from "~/middleware/auth";
// import { requirePermissions } from "~/middleware/permission";

// const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });
// const checkinQuerySchema = z.object({ userId: z.string() });

// export const checkinRoute = new Hono().post(
//     "/checkin",
//     describeRoute({
//         tags: ["events - registrations"],
//         summary: "Check-in a user",
//         responses: {
//             200: { description: "Checked in" },
//             404: { description: "Not found" },
//         },
//     }),
//     requireAuth,
//     requirePermissions("events:registrations:checkin"),
//     validator("param", idParamSchema),
//     validator("query", checkinQuerySchema),
//     async (c) => {
//         const eventId = c.req.param("id");
//         const userId = c.req.query("userId");
//         if (!eventId || !userId) return c.body(null, 400);

//         const [updated] = await db
//             .update(eventRegistration)
//             .set({ status: "attended", attendedAt: new Date() })
//             .where(
//                 and(
//                     eq(eventRegistration.eventId, eventId),
//                     eq(eventRegistration.userId, userId),
//                 ),
//             )
//             .returning();

//         if (!updated) return c.body(null, 404);

//         return c.json(updated);
//     },
// );
