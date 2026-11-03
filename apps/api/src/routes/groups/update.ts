import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { assertMayUseAssetUrls, promoteAssetUrls } from "~/lib/asset";
import { releaseReplacedAssetUrls } from "~/lib/asset/release";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { updateGroupResponseSchema, updateGroupSchema } from "./schema";

export const updateRoute = route().patch(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Partially update group",
        operationId: "updateGroup",
        description:
            "Partially update an existing group by its slug. Only provided fields will be updated. Requires being a group leader OR having 'groups:update' or 'groups:manage' (globally or scoped to this group). Changing the group's type additionally requires 'groups:update' or 'groups:manage' globally.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateGroupResponseSchema,
            description: "Group updated successfully",
        })
        .badRequest({ description: "Invalid input" })
        .forbidden({
            description:
                "Not a group leader or missing groups:update/groups:manage, or changing the type without a global groups:update/groups:manage",
        })
        .notFound({
            description: "Group with the specified slug does not exist",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["groups:update", "groups:manage"],
        scope: (c) => `group:${c.req.param("slug")}`,
        ownership: { param: "slug", check: isGroupLeader },
    }),
    validator("json", updateGroupSchema),
    async (c) => {
        const body = c.req.valid("json");
        const slug = c.req.param("slug");
        const ctx = c.get("ctx");
        const user = c.get("user");
        const { db, bucket } = ctx;

        // Check if group exists
        const existingGroup = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, slug))
            .limit(1);

        const previousGroup = existingGroup[0];
        if (!previousGroup) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        await assertMayUseAssetUrls(
            ctx,
            user.id,
            [body.imageUrl, body.logoUrl],
            [previousGroup.imageUrl, previousGroup.logoUrl],
        );

        // The type decides what the group is: who may lead it, whether it
        // takes join requests, whether Feide keeps its roster and what
        // registration priority it gives. That is the organisation's call, not
        // the group's own, so a leader — or a grant scoped to this group —
        // may not change it.
        //
        // Without that access the type is never written, not even when it
        // matches: the comparison is against a read that may be stale by the
        // time the update runs, and re-writing it would undo a type change an
        // administrator made in between.
        const { type, subtype, ...fields } = body;
        const writeType =
            type !== undefined &&
            (await hasPermission(ctx, user.id, [
                "groups:update",
                "groups:manage",
            ]));
        if (
            type !== undefined &&
            !writeType &&
            type.toLowerCase() !== previousGroup.type.toLowerCase()
        ) {
            throw new HTTPException(403, {
                message:
                    "Changing a group's type requires the global groups:update or groups:manage permission",
            });
        }

        // Only interest groups have a subtype. A form opened before an
        // administrator changed the type can still send the old one, so it is
        // judged against the type the group ends up with.
        const effectiveType = writeType ? type : previousGroup.type;
        const writeSubtype =
            subtype === undefined
                ? {}
                : {
                      subtype:
                          effectiveType.toLowerCase() === "interestgroup"
                              ? subtype
                              : null,
                  };

        // Validate fines admin if provided
        if (body.finesAdminId !== undefined && body.finesAdminId !== null) {
            const finesAdmin = await db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, body.finesAdminId))
                .limit(1);

            if (finesAdmin.length === 0) {
                throw new HTTPException(400, {
                    message: `User with ID "${body.finesAdminId}" does not exist`,
                });
            }
        }

        await db
            .update(schema.group)
            .set({
                ...fields,
                ...(writeType ? { type } : {}),
                ...writeSubtype,
                updatedAt: new Date(),
            })
            .where(eq(schema.group.slug, slug));

        // Etter lagringen: se promoteAssetUrls for hvorfor rekkefølgen teller.
        await promoteAssetUrls(bucket, [body.imageUrl, body.logoUrl]);

        await releaseReplacedAssetUrls(ctx, [
            [previousGroup.imageUrl, body.imageUrl],
            [previousGroup.logoUrl, body.logoUrl],
        ]);

        return c.json({ message: "Group updated successfully" }, 200);
    },
);
