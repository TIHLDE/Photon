import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isGroupMember } from "~/lib/group";
import { promoteAssetUrls } from "~/lib/asset";
import { sendNotification } from "~/lib/notification";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createFineSchema, fineSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const createFineRoute = route().post(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "Create fine",
        operationId: "createFine",
        description:
            "Create a new fine for a group member. Requires being a member of the group (bøter follow membership, not permissions). Root may fine across groups.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: fineSchema,
            description: "Fine created successfully",
        })
        .badRequest({
            description: "Invalid input or fines not activated for group",
        })
        .forbidden({
            description: "Not authorized to create fines for this group",
        })
        .notFound({ description: "Group or user not found" })
        .build(),
    requireAuth,
    validator("json", createFineSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const { db, bucket } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");

        /**
         * The permission was checked against the path's group, so a body
         * pointing somewhere else would write the fine into a group the caller
         * was never authorised for.
         */
        if (body.groupSlug !== groupSlug) {
            throw new HTTPException(400, {
                message: `Body group "${body.groupSlug}" does not match the group in the URL "${groupSlug}"`,
            });
        }

        // Validate group exists and has fines activated
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        if (!group.finesActivated) {
            throw new HTTPException(400, {
                message: `Fines are not activated for group "${groupSlug}"`,
            });
        }

        /**
         * Lepton's create rule was "admin, or a member of this group", and
         * that is now the whole rule: bøter are membership, not a permission.
         * The botsjef counts even if their membership lapsed, and root reaches
         * across groups.
         *
         * Checked before the body is validated: someone with no business in
         * this group must not learn from the error whether a given user exists
         * or is a member of it.
         */
        const isPrivileged =
            group.finesAdminId === user.id ||
            (await hasPermission(ctx, user.id, "root"));

        if (!isPrivileged && !(await isGroupMember(ctx, user.id, groupSlug))) {
            throw new HTTPException(403, {
                message: `Only members of group "${groupSlug}" can give fines in it`,
            });
        }

        // Validate user exists
        const targetUser = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, body.userId))
            .limit(1)
            .then((res) => res[0]);

        if (!targetUser) {
            throw new HTTPException(404, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        /**
         * Lepton refused this in `Fine.clean()` with UserIsNotInGroup. Without
         * it a group can fine anyone on the site, and the fined person cannot
         * even open the page the fine lives on.
         */
        if (!(await isGroupMember(ctx, body.userId, groupSlug))) {
            throw new HTTPException(400, {
                message: `User "${body.userId}" is not a member of group "${groupSlug}"`,
            });
        }

        /**
         * A paragraph belongs to exactly one group's lovverk. Without this
         * check a fine could cite another group's paragraph — the response
         * would then show a title from a lovverk the members cannot read.
         */
        if (body.lawId) {
            const law = await db
                .select()
                .from(schema.groupLaw)
                .where(eq(schema.groupLaw.id, body.lawId))
                .limit(1)
                .then((res) => res[0]);

            if (!law || law.groupSlug !== groupSlug) {
                throw new HTTPException(404, {
                    message: `Law with ID "${body.lawId}" not found in group "${groupSlug}"`,
                });
            }
        }

        // Uploaded pictures are staged until a row claims them; without
        // this the cleanup cron deletes the file after two days.
        await promoteAssetUrls(bucket, [body.image]);

        // Create the fine
        const [created] = await db
            .insert(schema.fine)
            .values({
                ...body,
                createdByUserId: user.id,
                status: "pending",
            })
            .returning();

        if (!created) {
            throw new HTTPException(500, { message: "Failed to create fine" });
        }

        // Re-read with the relations the response schema promises — the insert
        // itself returns the bare row, without user, creator or paragraph.
        const newFine = await db.query.fine.findFirst({
            where: eq(schema.fine.id, created.id),
            with: {
                user: { columns: { id: true, name: true, image: true } },
                createdByUser: {
                    columns: { id: true, name: true, image: true },
                },
                law: { columns: { id: true, paragraph: true, title: true } },
            },
        });

        if (!newFine) {
            throw new HTTPException(500, {
                message: "Fine was created but could not be read back",
            });
        }

        /**
         * Lepton told you when you had been fined; without this the bot only
         * appears if you happen to open the group's bøter tab. A failing
         * notification must not undo a fine that is already in the database, so
         * the error is logged rather than thrown.
         */
        const offence = newFine.law
            ? `paragraf "${Number(newFine.law.paragraph).toFixed(2)} ${newFine.law.title}"`
            : `"${newFine.reason}"`;

        try {
            await sendNotification(
                {
                    userId: newFine.userId,
                    title: `Du har fått en bot i "${group.name}"`,
                    description: `${newFine.createdByUser?.name ?? "Noen"} har gitt deg ${newFine.amount} bøter for å ha brutt ${offence} i gruppen ${group.name}`,
                    link: `/grupper/${groupSlug}?tab=boter`,
                },
                ctx,
            );
        } catch (error) {
            c.get("logger")?.error(
                { err: error, fineId: newFine.id, groupSlug },
                "Failed to send fine notification",
            );
        }

        return c.json(serializeFineLaw(newFine), 201);
    },
);
