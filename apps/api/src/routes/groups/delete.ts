import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import z from "zod";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { releaseAssetUrls } from "~/lib/asset/release";

export const deleteRoute = route().delete(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Delete a group",
        operationId: "deleteGroup",
        description:
            "Delete a group by its slug. Requires being the group's leader OR holding 'groups:delete' for all of TIHLDE, and repeating the slug in `confirm`. This action is irreversible and will remove all associated data, including memberships, fines (and their pictures), laws, forms and verv.",
    })
        .response({
            statusCode: 204,
            description: "Group successfully deleted",
        })
        .badRequest({
            description: "`confirm` does not repeat the group's slug",
        })
        .forbidden({
            description:
                "Not a group leader or missing groups:delete permission",
        })
        .notFound({
            description: "Group with the specified slug does not exist",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: "groups:delete",
        scope: (c) => `group:${c.req.param("slug")}`,
        ownership: { param: "slug", check: isGroupLeader },
    }),
    validator(
        "query",
        z.object({
            confirm: z.string().meta({
                description:
                    "The group's slug, typed out again. Deleting cascades over memberships, fines, laws, forms and verv, so it must never happen by accident.",
            }),
        }),
    ),
    async (c) => {
        const slug = c.req.param("slug");
        if (c.req.valid("query").confirm !== slug) {
            throw new HTTPException(400, {
                message: `Type the group's slug "${slug}" in confirm to delete it`,
            });
        }
        const ctx = c.get("ctx");
        const { db } = ctx;

        // Check if the group exists
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, slug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        // Delete the group and all associated data (cascading handled by DB).
        // The fines go first and by hand: a cascade would take their
        // pictures' URLs with it, and nothing else frees those files.
        const deletedFines = await db.transaction(async (tx) => {
            const fines = await tx
                .delete(schema.fine)
                .where(eq(schema.fine.groupSlug, slug))
                .returning({ image: schema.fine.image });
            await tx.delete(schema.group).where(eq(schema.group.slug, slug));
            return fines;
        });

        await releaseAssetUrls(ctx, [group.imageUrl, group.logoUrl]);
        // Not awaited: a group can hold any number of fine pictures, each
        // eight storage calls, and the deletion is already committed. The
        // helper never throws.
        void releaseAssetUrls(
            ctx,
            deletedFines.map((fine) => fine.image),
        );

        return c.body(null, 204);
    },
);
