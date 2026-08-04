import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { userAllergiesResponseSchema } from "../schema";

/**
 * One member's allergies, for the admin who is about to correct them.
 *
 * `GET /api/user/:id` deliberately leaves allergies out — they are not part of
 * a profile other members may read. This is the narrow exception, behind
 * `users:manage`.
 */
export const getUserAllergiesRoute = route().get(
    "/:id/allergies",
    describeRoute({
        tags: ["users"],
        summary: "Get a member's allergies",
        operationId: "getUserAllergies",
        description:
            "The allergies registered on one member. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userAllergiesResponseSchema,
            description: "The member's allergies",
        })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.req.param("id");

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        const rows = await db
            .select({
                slug: schema.allergy.slug,
                label: schema.allergy.label,
                description: schema.allergy.description,
            })
            .from(schema.userAllergy)
            .innerJoin(
                schema.allergy,
                eq(schema.allergy.slug, schema.userAllergy.allergySlug),
            )
            .where(eq(schema.userAllergy.userId, userId));

        return c.json({ allergies: rows }, 200);
    },
);
