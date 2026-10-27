import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { releaseAssetUrls } from "~/lib/asset/release";
import { HTTPAppException } from "~/lib/errors";
import { isArchivableGroup } from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { updateGroupResponseSchema } from "./schema";

const access = requireAccess({
    permission: "groups:manage",
    scope: (c) => `group:${c.req.param("slug")}`,
    ownership: { param: "slug", check: isGroupLeader },
});

export const archiveRoute = route()
    .post(
        "/:slug/archive",
        describeRoute({
            tags: ["groups"],
            summary: "Archive a group",
            operationId: "archiveGroup",
            description:
                "Archive a group. It leaves the group list but stays visible to everyone, nothing in it can be changed and it grants no permissions. Every fine in the group is deleted, pictures included, and does not come back on restore. Requires being the group's leader OR holding 'groups:manage'.",
        })
            .schemaResponse({
                statusCode: 200,
                schema: updateGroupResponseSchema,
                description: "Group archived",
            })
            .badRequest({
                description:
                    "Hovedstyret and groups whose roster follows Feide cannot be archived",
            })
            .forbidden({
                description:
                    "Not a group leader or missing groups:manage permission",
            })
            .notFound({
                description: "Group with the specified slug does not exist",
            })
            .build(),
        requireAuth,
        access,
        async (c) => {
            const slug = c.req.param("slug");
            const ctx = c.get("ctx");
            const { db } = ctx;

            const group = await db.query.group.findFirst({
                where: eq(schema.group.slug, slug),
            });

            if (!group) {
                throw new HTTPException(404, {
                    message: `Group with slug "${slug}" not found`,
                });
            }

            if (!isArchivableGroup(group)) {
                throw HTTPAppException.BadRequest(
                    "Denne gruppen kan ikke arkiveres.",
                );
            }

            // Botene følger ikke gruppen inn i arkivet: hvem som fikk bot for
            // hva er ikke historikk noen skal kunne lese senere.
            const deletedFines = await db.transaction(async (tx) => {
                await tx
                    .update(schema.group)
                    .set({ archivedAt: new Date() })
                    .where(eq(schema.group.slug, slug));

                return tx
                    .delete(schema.fine)
                    .where(eq(schema.fine.groupSlug, slug))
                    .returning({ image: schema.fine.image });
            });

            // Etter commit: referansesjekken leser databasen. Opprydningscronen
            // tar bare opplastinger som aldri ble brukt, så ingen andre fjerner
            // disse bildene.
            await releaseAssetUrls(
                ctx,
                deletedFines.map((fine) => fine.image),
            );

            return c.json({ message: "Group archived" }, 200);
        },
    )
    .post(
        "/:slug/unarchive",
        describeRoute({
            tags: ["groups"],
            summary: "Restore an archived group",
            operationId: "unarchiveGroup",
            description:
                "Bring an archived group back: it returns to the group list, becomes editable again, and its members, leader and verv regain the permissions the group grants. Requires being the group's leader OR holding 'groups:manage'.",
        })
            .schemaResponse({
                statusCode: 200,
                schema: updateGroupResponseSchema,
                description: "Group restored",
            })
            .forbidden({
                description:
                    "Not a group leader or missing groups:manage permission",
            })
            .notFound({
                description: "Group with the specified slug does not exist",
            })
            .build(),
        requireAuth,
        access,
        async (c) => {
            const slug = c.req.param("slug");
            const [restored] = await c
                .get("ctx")
                .db.update(schema.group)
                .set({ archivedAt: null })
                .where(eq(schema.group.slug, slug))
                .returning({ slug: schema.group.slug });

            if (!restored) {
                throw new HTTPException(404, {
                    message: `Group with slug "${slug}" not found`,
                });
            }

            return c.json({ message: "Group restored" }, 200);
        },
    );
