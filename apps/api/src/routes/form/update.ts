import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { FormHasSubmissionsException } from "~/lib/form/exceptions";
import {
    canManageForm,
    findDestructiveFieldChanges,
    resolveScheduledOpenState,
    updateFieldsAndOptions,
} from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { updateFormResponseSchema, updateFormSchema } from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Update form",
        operationId: "updateForm",
        description: "Update a form. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateFormResponseSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    validator("json", updateFormSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("id");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if form exists
        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
        });

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        // Check permissions
        const canManage = await canManageForm({ db, ...ctx }, formId, user.id);

        if (!canManage) {
            throw new HTTPException(403, {
                message: "You do not have permission to update this form",
            });
        }

        // The submission rules live on the group_form row, so they can only be
        // written when the form actually belongs to a group.
        const groupForm = await db.query.formGroupForm.findFirst({
            where: eq(schema.formGroupForm.formId, formId),
        });

        // Spørsmålene kan endres selv om skjemaet har svar — det er bare det å
        // fjerne noe noen har svart på som stoppes. Event forms are left alone
        // here — organisers may edit a survey while registrations are open, and
        // re-submitting replaces the old answer.
        if (body.fields && groupForm) {
            const problems = await findDestructiveFieldChanges(
                db,
                formId,
                body.fields,
            );
            if (problems.length > 0) {
                throw new FormHasSubmissionsException(problems);
            }
        }

        // Both updates are skipped when the body carries nothing for them:
        // Drizzle rejects a `set` where every value is undefined, so a patch
        // that only flips «åpent for svar» must not touch the form row.
        const formValues = {
            title: body.title,
            description: body.description,
            isTemplate: body.template,
        };

        if (Object.values(formValues).some((value) => value !== undefined)) {
            await db
                .update(schema.form)
                .set(formValues)
                .where(eq(schema.form.id, formId));
        }

        // `null` fjerner planleggingen; utelatt lar den stå.
        const openState = resolveScheduledOpenState({
            isOpenForSubmissions: body.is_open_for_submissions,
            opensAt:
                body.opens_at === undefined
                    ? undefined
                    : body.opens_at === null
                      ? null
                      : new Date(body.opens_at),
        });

        const groupFormValues = {
            emailReceiverOnSubmit: body.email_receiver_on_submit,
            canSubmitMultiple: body.can_submit_multiple,
            isOpenForSubmissions: openState.isOpenForSubmissions,
            opensAt: openState.opensAt,
            onlyForGroupMembers: body.only_for_group_members,
        };

        if (
            groupForm &&
            Object.values(groupFormValues).some((value) => value !== undefined)
        ) {
            await db
                .update(schema.formGroupForm)
                .set(groupFormValues)
                .where(eq(schema.formGroupForm.formId, formId));
        }

        // Update fields if provided
        if (body.fields) {
            await updateFieldsAndOptions(db, formId, body.fields);
        }

        // Fetch updated form
        const updatedForm = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
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

        const updatedGroupForm = groupForm
            ? await db.query.formGroupForm.findFirst({
                  where: eq(schema.formGroupForm.formId, formId),
              })
            : undefined;

        return c.json({
            id: updatedForm?.id,
            title: updatedForm?.title,
            description: updatedForm?.description,
            template: updatedForm?.isTemplate,
            email_receiver_on_submit:
                updatedGroupForm?.emailReceiverOnSubmit ?? null,
            can_submit_multiple: updatedGroupForm?.canSubmitMultiple ?? null,
            is_open_for_submissions:
                updatedGroupForm?.isOpenForSubmissions ?? null,
            opens_at: updatedGroupForm?.opensAt?.toISOString() ?? null,
            only_for_group_members:
                updatedGroupForm?.onlyForGroupMembers ?? null,
            created_at: updatedForm?.createdAt.toISOString(),
            updated_at: updatedForm?.updatedAt.toISOString(),
            fields: updatedForm?.fields.map((field) => ({
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
        });
    },
);
