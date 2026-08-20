import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { allergiesListSchema } from "../schema";

const querySchema = z.object({
    curated: z
        .stringbool()
        .optional()
        .describe(
            "Only return the curated allergies we maintain ourselves. Use this for anything a member picks from: the full catalogue also holds the free-text answers the Lepton migration imported, which is hundreds of near-duplicate rows.",
        ),
});

export const listAllergiesRoute = route().get(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "List all allergies",
        operationId: "listAllergies",
        description:
            "Retrieve a list of all possible allergies that users can have. Pass `curated=true` to get only the maintained list suitable for a picker.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: allergiesListSchema,
            description: "List of allergies retrieved successfully",
        })
        .build(),
    validator("query", querySchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { curated } = c.req.valid("query");

        const allergies = await db.query.allergy.findMany({
            where: curated ? (a, { eq }) => eq(a.curated, true) : undefined,
            orderBy: (a, { asc }) => [asc(a.label)],
            columns: {
                slug: true,
                label: true,
                description: true,
            },
        });

        return c.json(allergies, 200);
    },
);
