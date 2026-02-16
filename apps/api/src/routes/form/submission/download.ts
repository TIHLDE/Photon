import { hasPermission, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const downloadSubmissionsRoute = route().get(
    "/:formId/submissions/download",
    describeRoute({
        tags: ["forms"],
        summary: "Download submissions as CSV",
        operationId: "downloadFormSubmissions",
        description:
            "Download all submissions for a form as CSV. Requires permission to manage the form.",
        responses: {
            200: {
                description: "Success - Returns CSV file",
                content: {
                    "text/csv": {},
                },
            },
            403: {
                description: "Forbidden",
            },
            404: {
                description: "Form not found",
            },
        },
    }).build(),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("formId");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if form exists
        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
            with: {
                fields: {
                    orderBy: (fields, { asc }) => [asc(fields.order)],
                },
            },
        });

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        // Check permissions
        const hasAdminPermission = await hasPermission(
            { db, ...ctx },
            user.id,
            "forms:manage",
        );
        const canManage = await canManageForm(
            db,
            formId,
            user.id,
            hasAdminPermission,
        );

        if (!canManage) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to download submissions for this form",
            });
        }

        // Check if it's an event form - filter out waitlist
        const eventForm = await db.query.formEventForm.findFirst({
            where: eq(schema.formEventForm.formId, formId),
        });

        // Get submissions
        let submissions = await db.query.formSubmission.findMany({
            where: eq(schema.formSubmission.formId, formId),
            with: {
                user: true,
                answers: {
                    with: {
                        field: true,
                        selectedOptions: {
                            with: {
                                option: true,
                            },
                        },
                    },
                },
            },
            orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        });

        // Filter out waitlist users for event forms
        if (eventForm) {
            const registrations = await db
                .select()
                .from(schema.eventRegistration)
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, eventForm.eventId),
                        eq(schema.eventRegistration.status, "registered"),
                    ),
                );

            const registeredUserIds = new Set(
                registrations.map((r) => r.userId),
            );
            submissions = submissions.filter((s) =>
                registeredUserIds.has(s.userId),
            );
        }

        // Build CSV header
        const headers = [
            "name",
            "email",
            "study",
            "studyyear",
            ...form.fields.map((field) => field.title),
        ];

        // Build CSV rows
        const rows = submissions.map((submission) => {
            const row: string[] = [
                submission.user.name,
                submission.user.email,
                "", // study - would need to join with study program
                "", // studyyear - would need to join with study program
            ];

            // Add answer for each field
            for (const field of form.fields) {
                const answer = submission.answers.find(
                    (a) => a.fieldId === field.id,
                );
                if (!answer) {
                    row.push("");
                    continue;
                }

                if (answer.answerText) {
                    // Text answer - replace newlines with spaces
                    row.push(answer.answerText.replace(/\n/g, " "));
                } else if (answer.selectedOptions.length > 0) {
                    // Selected options - join with commas
                    row.push(
                        answer.selectedOptions
                            .map((so) => so.option.title)
                            .join(", "),
                    );
                } else {
                    row.push("");
                }
            }

            return row;
        });

        // Convert to CSV format
        const csvContent = [
            headers.map((h) => `"${h}"`).join(","),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        // Return CSV
        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="form_${formId}_submissions.csv"`,
            },
        });
    },
);
