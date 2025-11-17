import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import { route } from "~/lib/route";

const allergySchema = z.object({
    slug: z.string().meta({
        description: "Unique identifier for the allergy",
    }),
    label: z.string().meta({
        description: "Display name of the allergy",
    }),
    description: z.string().nullable().meta({
        description: "Detailed description of the allergy",
    }),
});

const responseSchema = z.array(allergySchema);

const schemaOpenAPI = await resolver(responseSchema).toOpenAPISchema();

export const listAllergiesRoute = route().get(
    "/",
    describeRoute({
        tags: ["user"],
        summary: "List all allergies",
        operationId: "listAllergies",
        description:
            "Retrieve a list of all possible allergies that users can have.",
        responses: {
            200: {
                description: "List of allergies retrieved successfully",
                content: {
                    "application/json": {
                        schema: schemaOpenAPI.schema,
                    },
                },
            },
        },
    }),
    async (c) => {
        const { db } = c.get("ctx");

        const allergies = await db.query.allergy.findMany({
            columns: {
                slug: true,
                label: true,
                description: true,
            },
        });

        return c.json(allergies, 200);
    },
);
