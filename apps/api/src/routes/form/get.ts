import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupFormOpen, userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { formDetailSchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Get form",
        operationId: "getForm",
        description: "Get a form by ID with all fields and options",
    })
        .schemaResponse({
            statusCode: 200,
            schema: formDetailSchema,
            description: "Success",
        })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("id");

        const form = await db.query.form.findFirst({
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

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        const hasAnswered = user
            ? await userHasSubmitted(db, form.id, user.id)
            : false;

        // A form is either standalone, attached to an event, or owned by a
        // group. The client needs to know which, plus the owner's submission
        // rules, to decide how to present and gate the form.
        const eventForm = await db.query.formEventForm.findFirst({
            where: eq(schema.formEventForm.formId, form.id),
            with: { event: true },
        });

        const groupForm = eventForm
            ? undefined
            : await db.query.formGroupForm.findFirst({
                  where: eq(schema.formGroupForm.formId, form.id),
                  with: { group: true },
              });

        const resourceType = eventForm
            ? "EventForm"
            : groupForm
              ? "GroupForm"
              : "Form";

        return c.json({
            id: form.id,
            title: form.title,
            description: form.description,
            template: form.isTemplate,
            resource_type: resourceType,
            viewer_has_answered: hasAnswered,
            type: eventForm?.type ?? null,
            event: eventForm
                ? {
                      id: eventForm.event.id,
                      title: eventForm.event.title,
                      slug: eventForm.event.slug,
                      start_date: eventForm.event.start.toISOString(),
                      location: eventForm.event.location,
                  }
                : null,
            group: groupForm
                ? {
                      slug: groupForm.group.slug,
                      name: groupForm.group.name,
                  }
                : null,
            can_submit_multiple: groupForm?.canSubmitMultiple ?? null,
            // Svarsiden spør «kan jeg svare nå?», så et skjema som er planlagt
            // fram i tid rapporteres som stengt til tidspunktet har passert.
            // `opens_at` lar siden si når det åpner.
            is_open_for_submissions: groupForm
                ? isGroupFormOpen(groupForm)
                : null,
            opens_at: groupForm?.opensAt?.toISOString() ?? null,
            only_for_group_members: groupForm?.onlyForGroupMembers ?? null,
            website_url: `/sporreskjema/${form.id}/`,
            created_at: form.createdAt.toISOString(),
            updated_at: form.updatedAt.toISOString(),
            fields: form.fields.map((field) => ({
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
