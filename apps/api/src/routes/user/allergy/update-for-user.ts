import { schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { ensureUserSettingsRow, setUserAllergies } from "~/lib/user/settings";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    updateUserAllergiesInputSchema,
    userAllergiesResponseSchema,
} from "../schema";

/**
 * Correct a member's allergies on their behalf.
 *
 * Not a general "edit the profile" endpoint: allergies are the one setting
 * someone else genuinely has to be able to fix, because arrangører order food
 * from them. Name and username are Feide's, and the rest of the settings are
 * the member's own answers.
 */
export const updateUserAllergiesRoute = route().put(
    "/:id/allergies",
    describeRoute({
        tags: ["users"],
        summary: "Set a member's allergies",
        operationId: "updateUserAllergies",
        description:
            "Replace the allergies registered on one member. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userAllergiesResponseSchema,
            description: "The allergies now registered",
        })
        .badRequest({ description: "Unknown allergy slug" })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", updateUserAllergiesInputSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const userId = c.req.param("id");
        const { allergies } = c.req.valid("json");

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: { id: true },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        const slugs = [...new Set(allergies)];

        // Checked up front rather than left to the foreign key: a bad slug
        // would otherwise surface as a 500 after the delete had already run.
        if (slugs.length > 0) {
            const known = await db
                .select({ slug: schema.allergy.slug })
                .from(schema.allergy)
                .where(inArray(schema.allergy.slug, slugs));

            const knownSlugs = new Set(known.map((row) => row.slug));
            const unknown = slugs.filter((slug) => !knownSlugs.has(slug));

            if (unknown.length > 0) {
                throw new HTTPException(400, {
                    message: `Unknown allergies: ${unknown.join(", ")}`,
                });
            }
        }

        await db.transaction(async (tx) => {
            await ensureUserSettingsRow(userId, { ...ctx, db: tx });
            await setUserAllergies(userId, slugs, { ...ctx, db: tx });
        });

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
