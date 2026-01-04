import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "~/db";
import { userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const formListResponseSchema = z.array(
    z.object({
        id: z.string().uuid(),
        title: z.string(),
        description: z.string().nullable(),
        template: z.boolean(),
        resource_type: z.string(),
        viewer_has_answered: z.boolean(),
        created_at: z.string(),
        updated_at: z.string(),
    }),
);

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["forms"],
        summary: "List forms",
        operationId: "listForms",
        description:
            "List all form templates by default. Use ?all=true to include all forms. Returns template forms by default.",
    })
        .schemaResponse(200, formListResponseSchema, "Success")
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const user = c.get("user");
        const showAll = c.req.query("all") === "true";

        // Query forms
        const forms = await db.query.form.findMany({
            where: showAll ? undefined : eq(schema.form.isTemplate, true),
            orderBy: (forms, { desc }) => [desc(forms.createdAt)],
        });

        // Check if user has answered each form
        const formsWithAnswers = await Promise.all(
            forms.map(async (form) => {
                const hasAnswered = user
                    ? await userHasSubmitted(db, form.id, user.id)
                    : false;

                return {
                    id: form.id,
                    title: form.title,
                    description: form.description,
                    template: form.isTemplate,
                    resource_type: "Form",
                    viewer_has_answered: hasAnswered,
                    created_at: form.createdAt.toISOString(),
                    updated_at: form.updatedAt.toISOString(),
                };
            }),
        );

        return c.json(formsWithAnswers);
    },
);
