// import { Hono } from "hono";
// import z from "zod";
// import { describeRoute, resolver, validator } from "hono-openapi";
// import db from "~/db";
// import { eventPayment } from "~/db/schema/events";
// import { desc } from "drizzle-orm";
// import { requireAuth } from "~/middleware/auth";
// import { requirePermissions } from "~/middleware/permission";

// const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });
// const paymentSchema = z.object({
//     id: z.uuid({ version: "v4" }),
//     eventId: z.uuid({ version: "v4" }),
//     userId: z.string(),
//     amountMinor: z.number(),
//     currency: z.string(),
//     provider: z.string().nullable().optional(),
//     providerPaymentId: z.string().nullable().optional(),
//     status: z.enum(["pending", "paid", "refunded", "failed"]),
//     createdAt: z.iso.datetime(),
//     updatedAt: z.iso.datetime(),
// });

// export const listPaymentRoute = new Hono().get(
//     "/",
//     describeRoute({
//         tags: ["events - payments"],
//         summary: "List payments for event",
//         responses: {
//             200: {
//                 description: "List of payments",
//                 content: {
//                     "application/json": {
//                         schema: resolver(
//                             z.object({ items: z.array(paymentSchema) }),
//                         ),
//                     },
//                 },
//             },
//         },
//     }),
//     requireAuth,
//     requirePermissions("events:payments:list"),
//     validator("param", idParamSchema),
//     async (c) => {
//         const id = c.req.param("id");
//         if (!id) return c.body(null, 400);

//         const items = await db.query.eventPayment.findMany({
//             where: (p, { eq }) => eq(p.eventId, id),
//             orderBy: [desc(eventPayment.createdAt)],
//         });

//         return c.json({ items });
//     },
// );
