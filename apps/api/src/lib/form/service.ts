import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { and, count, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";
import type {
    CreateAnswerInput,
    CreateFieldInput,
    UpdateFieldInput,
} from "~/routes/form/schema";
import {
    DuplicateSubmissionException,
    EventFormAttendanceRequiredException,
    EventRegistrationClosedException,
    FormNotOpenForSubmissionException,
    GroupFormOnlyForMembersException,
} from "./exceptions";

type Database = NodePgDatabase<DbSchema>;

/** Anything carrying a database handle — the Hono app context satisfies it. */
type DbCtx = { db: Database };

// ===== FORM HELPERS =====

/**
 * Om et gruppeskjema faktisk tar imot svar akkurat nå.
 *
 * Bryteren «åpent for svar» er hovedbryteren, og `opensAt` utsetter den bare:
 * et skjema som er planlagt fram i tid er stengt til tidspunktet har passert.
 * At det å planlegge en dato likevel åpner skjemaet den dagen — uansett hva
 * bryteren sto på fra før — er avgjort når raden skrives, se
 * `resolveScheduledOpenState`. Da kan bryteren av alltid bety stengt, og en
 * dato kan ikke bli liggende igjen og åpne skjemaet på nytt senere.
 */
export function isGroupFormOpen(
    groupForm: Pick<
        typeof schema.formGroupForm.$inferSelect,
        "isOpenForSubmissions" | "opensAt"
    >,
    now: Date = new Date(),
): boolean {
    if (!groupForm.isOpenForSubmissions) return false;
    return !groupForm.opensAt || groupForm.opensAt.getTime() <= now.getTime();
}

/**
 * De to feltene som styrer åpningen, slik de skal lagres.
 *
 * De henger sammen, så de må avgjøres i lag — ellers kan man lagre
 * kombinasjoner som ikke betyr noe:
 *
 * - Et tidspunkt betyr «skjemaet skal åpne da», så bryteren slås på. Det er
 *   det som gjør at et stengt skjema kan planlegges uten å åpnes med en gang,
 *   og derfor vinner tidspunktet også over en bryter som er sendt av i samme
 *   forespørsel — det er den mest presise beskjeden av de to.
 * - Bryteren av, uten et tidspunkt ved siden av, betyr «ikke ta imot svar», så
 *   planleggingen fjernes. Uten det ville et skjema man nettopp stengte åpnet
 *   seg selv igjen.
 *
 * `undefined` inn betyr «ikke rørt av denne forespørselen»; ut betyr «ikke
 * skriv dette feltet».
 */
export function resolveScheduledOpenState(input: {
    isOpenForSubmissions: boolean | undefined;
    opensAt: Date | null | undefined;
}): {
    isOpenForSubmissions: boolean | undefined;
    opensAt: Date | null | undefined;
} {
    if (input.opensAt) {
        return { isOpenForSubmissions: true, opensAt: input.opensAt };
    }
    if (input.isOpenForSubmissions === false) {
        return { isOpenForSubmissions: false, opensAt: null };
    }
    return input;
}

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
 * Endringene i `fields` som ville tatt svar med seg, beskrevet på norsk.
 *
 * Å skrive om spørsmålene er ikke destruktivt i seg selv: `updateFieldsAndOptions`
 * kjenner igjen spørsmål og alternativer på id, så tittel, rekkefølge og
 * «påkrevd» kan endres uten at noe forsvinner. Det som tar svar med seg er å
 * fjerne noe noen har svart på:
 *
 * - Fjernes et spørsmål, blir `answer.field_id` satt til null, og svaret hører
 *   ikke lenger til noe spørsmål.
 * - Fjernes et alternativ, kaskaderer det til `answer_option` — selve valget
 *   forsvinner.
 * - Byttes typen på et spørsmål, sletter oppdateringen alternativene som ikke
 *   passer den nye typen, med de samme følgene.
 *
 * Spørsmål og alternativer ingen har svart på kan fjernes fritt. Tom liste
 * betyr at oppdateringen er trygg.
 */
export async function findDestructiveFieldChanges(
    db: Database,
    formId: string,
    fields: UpdateFieldInput[],
): Promise<string[]> {
    const existingFields = await db.query.formField.findMany({
        where: eq(schema.formField.formId, formId),
        with: { options: true },
    });

    if (existingFields.length === 0) return [];

    const answeredFieldIds = new Set(
        (
            await db
                .selectDistinct({ fieldId: schema.formAnswer.fieldId })
                .from(schema.formAnswer)
                .where(
                    inArray(
                        schema.formAnswer.fieldId,
                        existingFields.map((field) => field.id),
                    ),
                )
        )
            .map((row) => row.fieldId)
            .filter((id): id is string => id !== null),
    );

    const existingOptionIds = existingFields.flatMap((field) =>
        field.options.map((option) => option.id),
    );

    const answeredOptionIds = new Set(
        existingOptionIds.length === 0
            ? []
            : (
                  await db
                      .selectDistinct({
                          optionId: schema.formAnswerOption.optionId,
                      })
                      .from(schema.formAnswerOption)
                      .where(
                          inArray(
                              schema.formAnswerOption.optionId,
                              existingOptionIds,
                          ),
                      )
              ).map((row) => row.optionId),
    );

    // Bare id-er som faktisk hører til dette skjemaet teller som «beholdt».
    // En id fra et annet skjema oppretter et nytt spørsmål her, den flytter
    // ikke det andre — se `updateFieldsAndOptions`.
    const ownFieldIds = new Set(existingFields.map((field) => field.id));
    const keptFields = new Map(
        fields
            .filter((field) => field.id && ownFieldIds.has(field.id))
            .map((field) => [field.id as string, field]),
    );

    const problems: string[] = [];

    for (const existing of existingFields) {
        const kept = keptFields.get(existing.id);

        if (!kept) {
            if (answeredFieldIds.has(existing.id)) {
                problems.push(
                    `spørsmålet «${existing.title}» er fjernet, og noen har svart på det`,
                );
            }
            continue;
        }

        if (kept.type !== existing.type && answeredFieldIds.has(existing.id)) {
            problems.push(
                `spørsmålet «${existing.title}» har byttet type, og noen har svart på det`,
            );
            // Typebyttet sletter alternativene uansett hvilke som er med i
            // lista, så det er ingen grunn til å telle dem opp i tillegg.
            continue;
        }

        // Uten `options` i payloaden sletter oppdateringen alle alternativene
        // til spørsmålet, akkurat som en tom liste ville gjort.
        const keptOptionIds = new Set(
            (kept.options ?? [])
                .map((option) => option.id)
                .filter((id): id is string => id !== undefined),
        );

        for (const option of existing.options) {
            if (
                !keptOptionIds.has(option.id) &&
                answeredOptionIds.has(option.id)
            ) {
                problems.push(
                    `alternativet «${option.title}» i «${existing.title}» er fjernet, og noen har valgt det`,
                );
            }
        }
    }

    return problems;
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

    const existingFieldIds = new Set(existingFields.map((f) => f.id));

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
        // En id som ikke hører til dette skjemaet behandles som et nytt
        // spørsmål: ellers ville en payload kunne skrive om spørsmålene i et
        // annet skjema, som den som sender den ikke nødvendigvis eier.
        if (fieldData.id && existingFieldIds.has(fieldData.id)) {
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

                const existingOptionIds = new Set(
                    existingOptions.map((o) => o.id),
                );

                // Update or create options
                for (const optionData of fieldData.options) {
                    // Som for spørsmålene: en id som ikke hører til dette
                    // spørsmålet blir et nytt alternativ, ikke en skriving inn
                    // i et annet skjema.
                    if (optionData.id && existingOptionIds.has(optionData.id)) {
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
            // Check if form is open — either stengt for godt, eller ennå ikke
            // åpnet fordi det er planlagt fram i tid.
            if (!isGroupFormOpen(groupForm)) {
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
 * Check if user can manage a form (edit, delete, view submissions).
 *
 * A form belongs to the group that owns it — the group for a group form, the
 * organizer for an event form — and a grant scoped to that group is enough.
 * That is what "Spørreskjema" ticked on a group's member permissions or on a
 * verv hands out, and it is already what creating the form asks for; without
 * the same check here, the group could make a form it could never read the
 * answers to. A global grant still satisfies the scoped check, so `root` and
 * org-wide `forms:manage` are unaffected.
 *
 * The group's leader passes regardless of any permission list, unchanged.
 *
 * A form owned by no group — a standalone or template form — has no scope to
 * check against, so it stays global-only.
 */
export async function canManageForm(
    ctx: DbCtx,
    formId: string,
    userId: string,
): Promise<boolean> {
    const { db } = ctx;

    const ownerGroupSlug = await formOwnerGroupSlug(db, formId);

    if (!ownerGroupSlug) {
        return await hasPermission(ctx, userId, "forms:manage");
    }

    if (
        await hasScopedPermission(
            ctx,
            userId,
            ["forms:manage", "forms:update"],
            `group:${ownerGroupSlug}`,
        )
    ) {
        return true;
    }

    const membership = await db.query.groupMembership.findFirst({
        where: and(
            eq(schema.groupMembership.groupSlug, ownerGroupSlug),
            eq(schema.groupMembership.userId, userId),
            eq(schema.groupMembership.role, "leader"),
        ),
    });

    return !!membership;
}

/**
 * The slug of the group a form belongs to, or null for a form owned by none.
 */
async function formOwnerGroupSlug(
    db: Database,
    formId: string,
): Promise<string | null> {
    const eventForm = await db.query.formEventForm.findFirst({
        where: eq(schema.formEventForm.formId, formId),
        with: { event: true },
    });

    if (eventForm) {
        return eventForm.event.organizerGroupSlug ?? null;
    }

    const groupForm = await db.query.formGroupForm.findFirst({
        where: eq(schema.formGroupForm.formId, formId),
    });

    return groupForm?.groupSlug ?? null;
}
