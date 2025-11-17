import { eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { schema } from "~/db";
import { userHasSubmitted } from "~/lib/form/service";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const groupFormListResponseSchema = z.array(
    z.object({
        id: z.string().uuid(),
        title: z.string(),
        description: z.string().nullable(),
        group: z.string(),
        email_receiver_on_submit: z.string().nullable(),
        can_submit_multiple: z.boolean(),
        is_open_for_submissions: z.boolean(),
        only_for_group_members: z.boolean(),
        resource_type: z.string(),
        viewer_has_answered: z.boolean(),
        created_at: z.string(),
        updated_at: z.string(),
    }),
);

export const listGroupFormsRoute = route().get(
    "/:slug/forms",
    describeRoute({
        tags: ["groups", "forms"],
        summary: "List group forms",
        operationId: "listGroupForms",
        description: "Get all forms for a group, filtered by user permissions",
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: resolver(groupFormListResponseSchema),
                    },
                },
            },
            404: {
                description: "Group not found",
            },
        },
    }),
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
