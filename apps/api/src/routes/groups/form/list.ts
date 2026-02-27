import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { userHasSubmitted } from "~/lib/form/service";
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
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
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

        // Filter forms based on permissions
        const visibleForms = groupForms.filter((gf) => {
            // Leaders see all forms
            if (isLeader) return true;

            // Members see open forms
            if (isMember && gf.isOpenForSubmissions) return true;

            // Public users only see open, non-member-only forms
            return gf.isOpenForSubmissions && !gf.onlyForGroupMembers;
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
                    only_for_group_members: groupForm.onlyForGroupMembers,
                    resource_type: "GroupForm",
                    viewer_has_answered: hasAnswered,
                    created_at: groupForm.form.createdAt.toISOString(),
                    updated_at: groupForm.form.updatedAt.toISOString(),
                };
            }),
        );

        return c.json(formsWithAnswers);
    },
);
