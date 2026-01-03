import z from "zod";
import { describeRoute } from "~/lib/openapi";
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

export const listAllergiesRoute = route().get(
    "/",
    describeRoute({
        tags: ["user"],
        summary: "List all allergies",
        operationId: "listAllergies",
        description:
            "Retrieve a list of all possible allergies that users can have.",
    })
        .schemaResponse(
            200,
            responseSchema,
            "List of allergies retrieved successfully",
        )
        .build(),
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
