import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupFormOpen, userHasSubmitted } from "~/lib/form/service";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { groupFormListSchema } from "../schema";

export const listGroupFormsRoute = route().get(
    "/:slug/forms",
    describeRoute({
        tags: ["groups", "forms"],
        summary: "List group forms",
        operationId: "listGroupForms",
        description: "Get all forms for a group, filtered by user permissions",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupFormListSchema,
            description: "Success",
        })
        .notFound({ description: "Group not found" })
        .forbidden({
            description: "The group is private and you are not a member",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const groupSlug = c.req.param("slug");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if group exists
        const group = await db.query.group.findFirst({
            where: eq(schema.group.slug, groupSlug),
        });

        if (!group) {
            throw new HTTPException(404, {
                message: "Group not found",
            });
        }

        await assertGroupVisible(ctx, group, user.id);

        // Check if user is group leader or member
        const membership = await db.query.groupMembership.findFirst({
            where: (m, { and, eq }) =>
                and(eq(m.groupSlug, groupSlug), eq(m.userId, user.id)),
        });

        const isLeader = membership?.role === "leader";
        const isMember = !!membership;

        // Get all group forms
        const groupForms = await db.query.formGroupForm.findMany({
            where: eq(schema.formGroupForm.groupSlug, groupSlug),
            with: {
                form: true,
            },
        });

        // Filter forms based on permissions. Et skjema som er planlagt fram i
        // tid teller som stengt her, så det dukker ikke opp for andre enn
        // lederne før det faktisk har åpnet.
        const visibleForms = groupForms.filter((gf) => {
            // Leaders see all forms
            if (isLeader) return true;

            const isOpenNow = isGroupFormOpen(gf);

            // Members see open forms
            if (isMember && isOpenNow) return true;

            // Public users only see open, non-member-only forms
            return isOpenNow && !gf.onlyForGroupMembers;
        });

        // Check if user has answered each form
        const formsWithAnswers = await Promise.all(
            visibleForms.map(async (groupForm) => {
                const hasAnswered = await userHasSubmitted(
                    db,
                    groupForm.form.id,
                    user.id,
                );

                return {
                    id: groupForm.form.id,
                    title: groupForm.form.title,
                    description: groupForm.form.description,
                    group: groupForm.groupSlug,
                    email_receiver_on_submit: groupForm.emailReceiverOnSubmit,
                    can_submit_multiple: groupForm.canSubmitMultiple,
                    is_open_for_submissions: groupForm.isOpenForSubmissions,
                    opens_at: groupForm.opensAt?.toISOString() ?? null,
                    is_open_now: isGroupFormOpen(groupForm),
                    only_for_group_members: groupForm.onlyForGroupMembers,
                    resource_type: "GroupForm",
                    viewer_has_answered: hasAnswered,
                    created_at: groupForm.form.createdAt.toISOString(),
                    updated_at: groupForm.form.updatedAt.toISOString(),
                };
            }),
        );

        // Uten en sortering kommer radene i den rekkefølgen Postgres finner
        // dem, og et skjema hopper nedover i lista hver gang det redigeres.
        formsWithAnswers.sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
        );

        return c.json(formsWithAnswers);
    },
);
