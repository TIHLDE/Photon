import { asc, eq, ilike, or } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import { schema } from "~/db";
import { route } from "~/lib/route";
import { groupSchema } from "./get";

const groupListSchema = z.array(groupSchema);

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["groups"],
        summary: "List groups",
        description:
            "Retrieve a list of all groups. Supports optional filtering by type and search query.",
        responses: {
            200: {
                description: "List of groups retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(groupListSchema),
                    },
                },
            },
        },
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const searchQuery = c.req.query("search");
        const typeFilter = c.req.query("type");

        const conditions = [];

        // Add search filter if provided
        if (searchQuery) {
            conditions.push(
                or(
                    ilike(schema.group.name, `%${searchQuery}%`),
                    ilike(schema.group.description, `%${searchQuery}%`),
                ),
            );
        }

        // Add type filter if provided
        if (typeFilter) {
            conditions.push(eq(schema.group.type, typeFilter));
        }

        const groups = await db.query.group.findMany({
            where: conditions.length > 0 ? conditions[0] : undefined,
            orderBy: [asc(schema.group.name)],
        });

        return c.json(groups);
    },
);
