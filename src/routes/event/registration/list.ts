import { eq, or } from "drizzle-orm";
import z from "zod";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { withPagination } from "~/middleware/pagination";

const registrationsSchema = z.object({
    registeredUsers: z.array(
        z
            .object({
                id: z.string().meta({ description: "User id" }),
                name: z.string().meta({ description: "User name" }),
                image: z
                    .string()
                    .nullable()
                    .meta({ description: "User image url (if any)" }),
            })
            .meta({
                description:
                    "List of users that are on the list. This field is paginated.",
            }),
    ),
    registeredCount: z.number().meta({
        description:
            "Total registered users. These users have access to the event.",
    }),
    waitlistCount: z.number().meta({
        description:
            "Number of users on the waitlist. These users are waiting in queue for a spot.",
    }),
});

export const getAllRegistrationsForEventsRoute = route().get(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Get event registrations",
        operationId: "listEventRegistrations",
    })
        .schemaResponse(200, z.array(registrationsSchema), "OK")
        .build(),
    ...withPagination(),
    async (c) => {
        const { db } = c.get("ctx");

        // since we track cancelled/no-show etc, track all statuses that have been registered succesfully
        const registeredFilter = or(
            eq(schema.eventRegistration.status, "registered"),
            eq(schema.eventRegistration.status, "attended"),
            eq(schema.eventRegistration.status, "no_show"),
        );

        const registrations = await db.query.eventRegistration.findMany({
            where: (registration, { eq, and }) =>
                and(
                    eq(registration.eventId, c.req.param("eventId")),
                    registeredFilter,
                ),
            limit: c.get("limit"),
            offset: c.get("offset"),
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

        const registeredCount = await db.$count(
            schema.eventRegistration,
            registeredFilter,
        );

        const waitlistCount = await db.$count(
            schema.eventRegistration,
            eq(schema.eventRegistration.status, "waitlisted"),
        );

        const returnRegistrations: z.infer<typeof registrationsSchema> = {
            registeredUsers: registrations.map((r) => ({
                id: r.userId,
                image: r.user.image,
                name: r.user.name,
            })),
            waitlistCount,
            registeredCount,
        };

        return c.json(returnRegistrations);
    },
);
