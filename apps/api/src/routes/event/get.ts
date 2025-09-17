// import { Hono } from "hono";
// import z from "zod";
// import { describeRoute, resolver, validator } from "hono-openapi";
// import db from "~/db";

// const eventSchema = z.object({
//     id: z.uuid({ version: "v4" }),
//     slug: z.string(),
//     title: z.string(),
//     description: z.string().nullable().optional(),
//     location: z.string().nullable().optional(),
//     startTime: z.iso.datetime(),
//     endTime: z.iso.datetime(),
//     capacity: z.number(),
//     allowWaitlist: z.boolean(),
//     createdByUserId: z.string().nullable().optional(),
//     createdAt: z.iso.datetime(),
//     updatedAt: z.iso.datetime(),
// });

// const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });

// export const getRoute = new Hono().get(
//     "/:id",
//     describeRoute({
//         tags: ["events"],
//         summary: "Get event by id",
//         responses: {
//             200: {
//                 description: "Event",
//                 content: {
//                     "application/json": { schema: resolver(eventSchema) },
//                 },
//             },
//             404: { description: "Not found" },
//         },
//     }),
//     validator("param", idParamSchema),
//     async (c) => {
//         const id = c.req.param("id");
//         if (!id) return c.body(null, 400);

//         const item = await db.query.event.findFirst({
//             where: (e, { eq }) => eq(e.id, id),
//         });

//         if (!item) return c.body(null, 404);

//         return c.json(item);
//     },
// );
