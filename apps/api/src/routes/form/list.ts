import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { formListSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["forms"],
        summary: "List forms",
        operationId: "listForms",
        description:
            "List all form templates by default. Use ?all=true to include all forms. Returns template forms by default.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: formListSchema,
            description: "Success",
        })
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
