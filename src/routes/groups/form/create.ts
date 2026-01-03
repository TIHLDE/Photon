import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { createFieldsAndOptions } from "~/lib/form/service";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createGroupFormSchema } from "../../../lib/form/schema";

export const createGroupFormRoute = route().post(
    "/:slug/forms",
    describeAuthenticatedRoute({
        tags: ["groups", "forms"],
        summary: "Create group form",
        operationId: "createGroupForm",
        description:
            "Create a form for a group. Requires group leader permission or forms:create permission.",
    })

        .response(201, "Created")
        .forbidden()
        .notFound("Group not found")
        .build(),
    requireAuth,
    validator("json", createGroupFormSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
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

        // Check permission - must have forms:create or be group leader
        const hasFormsCreate = await hasPermission(
            { db, ...ctx },
            user.id,
            "forms:create",
        );
        const isGroupLeader = await db.query.groupMembership.findFirst({
            where: (membership, { and, eq }) =>
                and(
                    eq(membership.groupSlug, groupSlug),
                    eq(membership.userId, user.id),
                    eq(membership.role, "leader"),
                ),
        });

        if (!hasFormsCreate && !isGroupLeader) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to create forms for this group",
            });
        }

        // Create form
        const [form] = await db
            .insert(schema.form)
            .values({
                title: body.title,
                description: body.description,
                isTemplate: false,
            })
            .returning();

        if (!form) {
            throw new HTTPException(500, {
                message: "Failed to create form",
            });
        }

        // Create group form link
        await db.insert(schema.formGroupForm).values({
            formId: form.id,
            groupSlug,
            emailReceiverOnSubmit: body.email_receiver_on_submit,
            canSubmitMultiple: body.can_submit_multiple,
            isOpenForSubmissions: body.is_open_for_submissions,
            onlyForGroupMembers: body.only_for_group_members,
        });

        // Create fields and options
        if (body.fields && body.fields.length > 0) {
            await createFieldsAndOptions(db, form.id, body.fields);
        }

        // Fetch complete form
        const createdForm = await db.query.form.findFirst({
            where: eq(schema.form.id, form.id),
            with: {
                fields: {
                    orderBy: (fields, { asc }) => [asc(fields.order)],
                    with: {
                        options: {
                            orderBy: (options, { asc }) => [asc(options.order)],
                        },
                    },
                },
            },
        });

        const groupForm = await db.query.formGroupForm.findFirst({
            where: (gf, { eq }) => eq(gf.formId, form.id),
        });

        return c.json(
            {
                id: createdForm?.id,
                title: createdForm?.title,
                description: createdForm?.description,
                group: groupSlug,
                email_receiver_on_submit: groupForm?.emailReceiverOnSubmit,
                can_submit_multiple: groupForm?.canSubmitMultiple,
                is_open_for_submissions: groupForm?.isOpenForSubmissions,
                only_for_group_members: groupForm?.onlyForGroupMembers,
                resource_type: "GroupForm",
                created_at: createdForm?.createdAt.toISOString(),
                updated_at: createdForm?.updatedAt.toISOString(),
                fields: createdForm?.fields.map((field) => ({
                    id: field.id,
                    title: field.title,
                    type: field.type,
                    required: field.required,
                    order: field.order,
                    options: field.options.map((opt) => ({
                        id: opt.id,
                        title: opt.title,
                        order: opt.order,
                    })),
                })),
            },
            201,
        );
    },
);
