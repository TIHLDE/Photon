import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { allergiesListSchema } from "../schema";

export const listAllergiesRoute = route().get(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "List all allergies",
        operationId: "listAllergies",
        description:
            "Retrieve a list of all possible allergies that users can have.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: allergiesListSchema,
            description: "List of allergies retrieved successfully",
        })
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
