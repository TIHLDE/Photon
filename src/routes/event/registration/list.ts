import { and, desc, eq, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    PaginationSchema,
    PagniationResponseSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";

const registeredUserSchema = z.object({
    id: z.string().meta({ description: "User id" }),
    name: z.string().meta({ description: "User name" }),
    image: z
        .string()
        .nullable()
        .meta({ description: "User image url (if any)" }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    registeredUsers: z
        .array(registeredUserSchema)
        .describe("List of registered users (paginated)"),
});

export const getAllRegistrationsForEventsRoute = route().get(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Get event registrations",
        operationId: "listEventRegistrations",
        description:
            "Retrieve a paginated list of users registered for a specific event, including registered and waitlist counts",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", PaginationSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { pageSize, page } = c.req.valid("query");

        const pageOffset = getPageOffset(page, pageSize);

        // since we track cancelled/no-show etc, track all statuses that have been registered succesfully
        const registeredFilter = or(
            eq(schema.eventRegistration.status, "registered"),
            eq(schema.eventRegistration.status, "attended"),
            eq(schema.eventRegistration.status, "no_show"),
        );

        const filters = and(
            eq(schema.eventRegistration.eventId, c.req.param("eventId")),
            registeredFilter,
        );

        const registrationCount = await db.$count(
            schema.eventRegistration,
            filters,
        );

        const registrations = await db.query.eventRegistration.findMany({
            orderBy: (r) => [desc(r.createdAt)],
            where: filters,
            limit: pageSize,
            offset: pageOffset,
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        const totalPages = getTotalPages(registrationCount, pageSize);

        const returnRegistrations = registrations.map((r) => ({
            id: r.userId,
            image: r.user.image,
            name: r.user.name,
        }));

        return c.json({
            totalCount: registrationCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            registeredUsers: returnRegistrations,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
