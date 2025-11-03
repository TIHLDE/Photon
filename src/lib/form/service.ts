import { and, count, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";
import type { DbSchema } from "~/db";
import { schema } from "~/db";
import {
    DuplicateSubmissionException,
    EventFormAttendanceRequiredException,
    EventRegistrationClosedException,
    FormNotOpenForSubmissionException,
    GroupFormOnlyForMembersException,
} from "./exceptions";
import type {
    CreateAnswerInput,
    CreateFieldInput,
    UpdateFieldInput,
} from "./schema";

type Database = NodePgDatabase<DbSchema>;

// ===== FORM HELPERS =====

/**
 * Check if user has submitted to a form
 */
export async function userHasSubmitted(
    db: Database,
    formId: string,
    userId: string,
): Promise<boolean> {
    const submission = await db.query.formSubmission.findFirst({
        where: and(
            eq(schema.formSubmission.formId, formId),
            eq(schema.formSubmission.userId, userId),
        ),
    });
    return !!submission;
}

/**
 * Get form with all details (fields, options)
 */
export async function getFormWithDetails(db: Database, formId: string) {
    return await db.query.form.findFirst({
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
}

/**
 * Get event form with form details
 */
export async function getEventFormWithDetails(
    db: Database,
    eventId: string,
    type: "survey" | "evaluation",
) {
    return await db.query.formEventForm.findFirst({
        where: and(
            eq(schema.formEventForm.eventId, eventId),
            eq(schema.formEventForm.type, type),
        ),
        with: {
            form: {
                with: {
                    fields: {
                        orderBy: (fields, { asc }) => [asc(fields.order)],
                        with: {
                            options: {
                                orderBy: (options, { asc }) => [
                                    asc(options.order),
                                ],
                            },
                        },
                    },
                },
            },
        },
    });
}

/**
 * Get group form with form details
 */
export async function getGroupFormWithDetails(
    db: Database,
    groupSlug: string,
    formId: string,
) {
    return await db.query.formGroupForm.findFirst({
        where: and(
            eq(schema.formGroupForm.groupSlug, groupSlug),
            eq(schema.formGroupForm.formId, formId),
        ),
        with: {
            form: {
                with: {
                    fields: {
                        orderBy: (fields, { asc }) => [asc(fields.order)],
                        with: {
                            options: {
                                orderBy: (options, { asc }) => [
                                    asc(options.order),
                                ],
                            },
                        },
                    },
                },
            },
        },
    });
}

// ===== FIELD & OPTION MANAGEMENT =====

/**
 * Create fields and options for a form
 */
export async function createFieldsAndOptions(
    db: Database,
    formId: string,
    fields: CreateFieldInput[],
) {
    for (const fieldData of fields) {
        const [field] = await db
            .insert(schema.formField)
            .values({
                formId,
                title: fieldData.title,
                type: fieldData.type,
                required: fieldData.required,
                order: fieldData.order,
            })
            .returning({ id: schema.formField.id });

        if (!field) {
            throw new HTTPException(500, {
                message: "Failed to create field",
            });
        }

        // Create options if field type supports them
        if (
            fieldData.options &&
            (fieldData.type === "multiple_select" ||
                fieldData.type === "single_select")
        ) {
            for (const optionData of fieldData.options) {
                await db.insert(schema.formOption).values({
                    fieldId: field.id,
                    title: optionData.title,
                    order: optionData.order,
                });
            }
        }
    }
}

/**
 * Update fields and options for a form
 * - Fields/options with id: update
 * - Fields/options without id: create
 * - Fields/options not in the list: delete
 */
export async function updateFieldsAndOptions(
    db: Database,
    formId: string,
    fields: UpdateFieldInput[],
) {
    // Get existing fields
    const existingFields = await db.query.formField.findMany({
        where: eq(schema.formField.formId, formId),
        with: {
            options: true,
        },
    });

    const updatedFieldIds = fields
        .filter((f) => f.id)
        .map((f) => f.id as string);

    // Delete fields not in the update list
    const fieldsToDelete = existingFields.filter(
        (f) => !updatedFieldIds.includes(f.id),
    );
    if (fieldsToDelete.length > 0) {
        await db.delete(schema.formField).where(
            inArray(
                schema.formField.id,
                fieldsToDelete.map((f) => f.id),
            ),
        );
    }

    // Update or create fields
    for (const fieldData of fields) {
        if (fieldData.id) {
            // Update existing field
            await db
                .update(schema.formField)
                .set({
                    title: fieldData.title,
                    type: fieldData.type,
                    required: fieldData.required,
                    order: fieldData.order,
                })
                .where(eq(schema.formField.id, fieldData.id));

            // Handle options
            if (
                fieldData.options &&
                (fieldData.type === "multiple_select" ||
                    fieldData.type === "single_select")
            ) {
                const existingOptions = await db.query.formOption.findMany({
                    where: eq(schema.formOption.fieldId, fieldData.id),
                });

                const updatedOptionIds = fieldData.options
                    .filter((o) => o.id)
                    .map((o) => o.id as string);

                // Delete options not in the update list
                const optionsToDelete = existingOptions.filter(
                    (o) => !updatedOptionIds.includes(o.id),
                );
                if (optionsToDelete.length > 0) {
                    await db.delete(schema.formOption).where(
                        inArray(
                            schema.formOption.id,
                            optionsToDelete.map((o) => o.id),
                        ),
                    );
                }

                // Update or create options
                for (const optionData of fieldData.options) {
                    if (optionData.id) {
                        await db
                            .update(schema.formOption)
                            .set({
                                title: optionData.title,
                                order: optionData.order,
                            })
                            .where(eq(schema.formOption.id, optionData.id));
                    } else {
                        await db.insert(schema.formOption).values({
                            fieldId: fieldData.id,
                            title: optionData.title,
                            order: optionData.order,
                        });
                    }
                }
            } else {
                // Field type doesn't support options, delete any existing
                await db
                    .delete(schema.formOption)
                    .where(eq(schema.formOption.fieldId, fieldData.id));
            }
        } else {
            // Create new field
            const [field] = await db
                .insert(schema.formField)
                .values({
                    formId,
                    title: fieldData.title,
                    type: fieldData.type,
                    required: fieldData.required,
                    order: fieldData.order,
                })
                .returning({ id: schema.formField.id });

            if (!field) {
                throw new HTTPException(500, {
                    message: "Failed to create field",
                });
            }

            // Create options
            if (
                fieldData.options &&
                (fieldData.type === "multiple_select" ||
                    fieldData.type === "single_select")
            ) {
                for (const optionData of fieldData.options) {
                    await db.insert(schema.formOption).values({
                        fieldId: field.id,
                        title: optionData.title,
                        order: optionData.order,
                    });
                }
            }
        }
    }
}

// ===== SUBMISSION VALIDATION =====

/**
 * Validate and create submission for a form
 * Handles duplicate submission logic based on form type
 */
export async function validateAndCreateSubmission(
    db: Database,
    formId: string,
    userId: string,
    answers: CreateAnswerInput[],
    options?: {
        eventId?: string;
        groupSlug?: string;
    },
): Promise<string> {
    // Check for existing submission
    const existingSubmission = await db.query.formSubmission.findFirst({
        where: and(
            eq(schema.formSubmission.formId, formId),
            eq(schema.formSubmission.userId, userId),
        ),
    });

    // Handle event form logic
    if (options?.eventId) {
        const eventForm = await db.query.formEventForm.findFirst({
            where: eq(schema.formEventForm.formId, formId),
        });

        if (eventForm) {
            // Check if evaluation form - must be attendee
            if (eventForm.type === "evaluation") {
                const registration = await db.query.eventRegistration.findFirst(
                    {
                        where: and(
                            eq(
                                schema.eventRegistration.eventId,
                                options.eventId,
                            ),
                            eq(schema.eventRegistration.userId, userId),
                            eq(schema.eventRegistration.status, "attended"),
                        ),
                    },
                );

                if (!registration) {
                    throw new EventFormAttendanceRequiredException();
                }
            }

            // Check if registration is still open
            const event = await db.query.event.findFirst({
                where: eq(schema.event.id, options.eventId),
            });

            if (event?.isRegistrationClosed && existingSubmission) {
                throw new EventRegistrationClosedException();
            }

            // Delete existing submission if before registration close
            if (existingSubmission && !event?.isRegistrationClosed) {
                await db
                    .delete(schema.formSubmission)
                    .where(eq(schema.formSubmission.id, existingSubmission.id));
            }
        }
    }

    // Handle group form logic
    if (options?.groupSlug) {
        const groupForm = await db.query.formGroupForm.findFirst({
            where: and(
                eq(schema.formGroupForm.formId, formId),
                eq(schema.formGroupForm.groupSlug, options.groupSlug),
            ),
        });

        if (groupForm) {
            // Check if form is open
            if (!groupForm.isOpenForSubmissions) {
                throw new FormNotOpenForSubmissionException();
            }

            // Check if only for members
            if (groupForm.onlyForGroupMembers) {
                const membership = await db.query.groupMembership.findFirst({
                    where: and(
                        eq(schema.groupMembership.groupSlug, options.groupSlug),
                        eq(schema.groupMembership.userId, userId),
                    ),
                });

                if (!membership) {
                    throw new GroupFormOnlyForMembersException();
                }
            }

            // Check duplicate submission rules
            if (existingSubmission && !groupForm.canSubmitMultiple) {
                throw new DuplicateSubmissionException();
            }
        }
    }

    // Base form: no duplicates
    if (!options?.eventId && !options?.groupSlug && existingSubmission) {
        throw new DuplicateSubmissionException();
    }

    // Create submission
    const [submission] = await db
        .insert(schema.formSubmission)
        .values({
            formId,
            userId,
        })
        .returning({ id: schema.formSubmission.id });

    if (!submission) {
        throw new HTTPException(500, {
            message: "Failed to create submission",
        });
    }

    // Create answers
    await createAnswers(db, submission.id, answers);

    return submission.id;
}

/**
 * Create answers for a submission
 */
async function createAnswers(
    db: Database,
    submissionId: string,
    answers: CreateAnswerInput[],
) {
    for (const answerData of answers) {
        const [answer] = await db
            .insert(schema.formAnswer)
            .values({
                submissionId,
                fieldId: answerData.field.id,
                answerText: answerData.answer_text || null,
            })
            .returning({ id: schema.formAnswer.id });

        if (!answer) {
            throw new HTTPException(500, {
                message: "Failed to create answer",
            });
        }

        // Create selected options if provided
        if (
            answerData.selected_options &&
            answerData.selected_options.length > 0
        ) {
            for (const option of answerData.selected_options) {
                await db.insert(schema.formAnswerOption).values({
                    answerId: answer.id,
                    optionId: option.id,
                });
            }
        }
    }
}

// ===== STATISTICS =====

/**
 * Calculate statistics for a form
 * Returns option counts and percentages for select-type fields
 */
export async function calculateFormStatistics(db: Database, formId: string) {
    const form = await getFormWithDetails(db, formId);

    if (!form) {
        throw new HTTPException(404, { message: "Form not found" });
    }

    // Get total submissions count
    const [submissionCount] = await db
        .select({ count: count() })
        .from(schema.formSubmission)
        .where(eq(schema.formSubmission.formId, formId));

    const totalSubmissions = submissionCount?.count || 0;

    // Calculate statistics for each field with options
    const statistics = await Promise.all(
        form.fields
            .filter(
                (field) =>
                    field.type === "multiple_select" ||
                    field.type === "single_select",
            )
            .map(async (field) => {
                const optionsWithStats = await Promise.all(
                    field.options.map(async (option) => {
                        // Count how many times this option was selected
                        const [result] = await db
                            .select({ count: count() })
                            .from(schema.formAnswerOption)
                            .innerJoin(
                                schema.formAnswer,
                                eq(
                                    schema.formAnswerOption.answerId,
                                    schema.formAnswer.id,
                                ),
                            )
                            .innerJoin(
                                schema.formSubmission,
                                eq(
                                    schema.formAnswer.submissionId,
                                    schema.formSubmission.id,
                                ),
                            )
                            .where(
                                and(
                                    eq(
                                        schema.formAnswerOption.optionId,
                                        option.id,
                                    ),
                                    eq(schema.formSubmission.formId, formId),
                                ),
                            );

                        const answerAmount = result?.count || 0;
                        const answerPercentage =
                            totalSubmissions > 0
                                ? Number(
                                      (
                                          (answerAmount / totalSubmissions) *
                                          100
                                      ).toFixed(2),
                                  )
                                : 0;

                        return {
                            id: option.id,
                            title: option.title,
                            answer_amount: answerAmount,
                            answer_percentage: answerPercentage,
                        };
                    }),
                );

                return {
                    id: field.id,
                    title: field.title,
                    type: field.type,
                    required: field.required,
                    options: optionsWithStats,
                };
            }),
    );

    return {
        id: form.id,
        title: form.title,
        statistics,
    };
}

// ===== PERMISSIONS =====

/**
 * Check if user can manage a form (edit, delete, view submissions)
 */
export async function canManageForm(
    db: Database,
    formId: string,
    userId: string,
    hasAdminPermission: boolean,
): Promise<boolean> {
    if (hasAdminPermission) {
        return true;
    }

    // Check if it's an event form
    const eventForm = await db.query.formEventForm.findFirst({
        where: eq(schema.formEventForm.formId, formId),
        with: {
            event: {
                with: {
                    organizer: true,
                },
            },
        },
    });

    if (eventForm) {
        // Check if user is event organizer or has group leadership
        const organizerSlug = eventForm.event.organizerGroupSlug;
        if (organizerSlug) {
            const membership = await db.query.groupMembership.findFirst({
                where: and(
                    eq(schema.groupMembership.groupSlug, organizerSlug),
                    eq(schema.groupMembership.userId, userId),
                    eq(schema.groupMembership.role, "leader"),
                ),
            });
            return !!membership;
        }
    }

    // Check if it's a group form
    const groupForm = await db.query.formGroupForm.findFirst({
        where: eq(schema.formGroupForm.formId, formId),
    });

    if (groupForm) {
        const membership = await db.query.groupMembership.findFirst({
            where: and(
                eq(schema.groupMembership.groupSlug, groupForm.groupSlug),
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.role, "leader"),
            ),
        });
        return !!membership;
    }

    return false;
}
