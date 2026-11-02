import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { releaseAssetUrls } from "~/lib/asset/release";
import { HTTPAppException } from "~/lib/errors";
import { isArchivableGroup, removeUserFromGroup } from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { updateGroupResponseSchema } from "./schema";

const archiveAccess = requireAccess({
    permission: "groups:manage",
    scope: (c) => `group:${c.req.param("slug")}`,
    ownership: { param: "slug", check: isGroupLeader },
});

// Arkivering tar alle medlemmene ut, lederen også, så en arkivert gruppe har
// ingen leder som kunne gjenopprettet den.
const unarchiveAccess = requireAccess({
    permission: "groups:manage",
    scope: (c) => `group:${c.req.param("slug")}`,
});

export const archiveRoute = route()
    .post(
        "/:slug/archive",
        describeRoute({
            tags: ["groups"],
            summary: "Archive a group",
            operationId: "archiveGroup",
            description:
                "Archive a group. It leaves the group list but stays visible to everyone, nothing in it can be changed and it grants no permissions. Every member, the leader included, is removed and moved to the group's member history, and loses any verv held in it. Every fine in the group is deleted, pictures included. Neither comes back on restore. Requires being the group's leader OR holding 'groups:manage'.",
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
        archiveAccess,
        async (c) => {
            const slug = c.req.param("slug");
            const ctx = c.get("ctx");
            const { db } = ctx;

            const group = await db.query.group.findFirst({
                where: { slug },
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
                const txCtx = { ...ctx, db: tx };

                // Botsjefen er en utnevnelse, ikke et medlemskap, og gir
                // tilgang til bøtene uansett hvem som er i gruppen. Den må
                // følge medlemmene ut, ellers styrer vedkommende bøtene til en
                // gjenopprettet gruppe de ikke lenger er med i.
                await tx
                    .update(schema.group)
                    .set({ archivedAt: new Date(), finesAdminId: null })
                    .where(eq(schema.group.slug, slug));

                // Medlemmene går til «tidligere medlemmer» på samme vei som
                // når de fjernes én og én: historikkraden skrives, vervene i
                // gruppen og et koblet ledervers i HS tas tilbake.
                const members = await tx
                    .select({ userId: schema.groupMembership.userId })
                    .from(schema.groupMembership)
                    .where(eq(schema.groupMembership.groupSlug, slug));
                for (const { userId } of members) {
                    await removeUserFromGroup(txCtx, userId, slug);
                }

                return tx
                    .delete(schema.fine)
                    .where(eq(schema.fine.groupSlug, slug))
                    .returning({ image: schema.fine.image });
            });

            // Etter commit: referansesjekken leser databasen. Opprydningscronen
            // tar bare opplastinger som aldri ble brukt, så ingen andre fjerner
            // disse bildene.
            //
            // Ventes ikke på: hvert bilde er åtte slettekall mot S3, og en
            // gruppe med mange bøter ville holdt svaret lenger enn klientens
            // tidsavbrudd — etter at arkiveringen allerede er lagret. Den
            // kaster aldri, så ingen avvisning slipper ut.
            void releaseAssetUrls(
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
                "Bring an archived group back: it returns to the group list and becomes editable again. It comes back empty — archiving moved every member to the member history and deleted the fines — so members and a leader have to be added anew. Requires 'groups:manage', since an archived group has no leader.",
        })
            .schemaResponse({
                statusCode: 200,
                schema: updateGroupResponseSchema,
                description: "Group restored",
            })
            .forbidden({
                description: "Missing groups:manage permission",
            })
            .notFound({
                description: "Group with the specified slug does not exist",
            })
            .build(),
        requireAuth,
        unarchiveAccess,
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
