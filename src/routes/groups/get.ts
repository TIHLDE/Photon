import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { route } from "~/lib/route";

export const groupSchema = z.object({
    slug: z.string().meta({ description: "Group slug" }),
    imageUrl: z.string().nullable().meta({ description: "Group image URL" }),
    name: z.string().meta({ description: "Group name" }),
    description: z
        .string()
        .nullable()
        .meta({ description: "Group description" }),
    contactEmail: z
        .string()
        .nullable()
        .meta({ description: "Group contact email" }),
    type: z.string().meta({ description: "Group type" }),
    finesInfo: z.string().meta({ description: "Group fines info" }),
    finesActivated: z.boolean().meta({ description: "Group fines activated" }),
    finesAdminId: z
        .string()
        .nullable()
        .meta({ description: "Group fines admin ID" }),
    createdAt: z.string().meta({ description: "Creation timestamp" }),
    updatedAt: z.string().meta({ description: "Last update timestamp" }),
});

export const getRoute = route().get(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Get group by slug",
        operationId: "getGroup",
        description:
            "Retrieve detailed information about a specific group by its slug identifier.",
        responses: {
            200: {
                description: "Group details retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(groupSchema),
                    },
                },
            },
            404: {
                description:
                    "Not Found - Group with the specified slug does not exist",
            },
        },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const slug = c.req.param("slug");

        const group = await db.query.group.findFirst({
            where: (group, { eq }) => eq(group.slug, slug),
        });

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        return c.json(group);
    },
);
