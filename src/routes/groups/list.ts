import { asc, eq, ilike, or } from "drizzle-orm";
import z from "zod";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { groupSchema } from "./get";

const groupListSchema = z.array(groupSchema);

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["groups"],
        summary: "List groups",
        operationId: "listGroups",
        description:
            "Retrieve a list of all groups. Supports optional filtering by type and search query.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupListSchema,
            description: "List of groups retrieved successfully",
        })
        .build(),
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
