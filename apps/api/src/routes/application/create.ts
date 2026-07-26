import { schema } from "@photon/db";
import type {
    ApplicationAttachmentKind,
    ApplicationType,
} from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import {
    financeEmailForGroup,
    isSelectableGroupType,
} from "~/lib/application/groups";
import {
    buildSignature,
    claimAttachments,
    findApplicationById,
    generateApplicationPdf,
} from "~/lib/application/service";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import type { LoggerType } from "~/middleware/logger";
import { requireAuth } from "~/middleware/auth";
import { notifyApplicationSubmitted } from "./notify";
import {
    createApplicationResponseSchema,
    createExpenseApplicationSchema,
    createHsCaseApplicationSchema,
    createSupportApplicationSchema,
} from "./schema";

/**
 * Resolve a group slug, rejecting unknown or non-budget-holding ones before
 * anything is written.
 */
async function requireGroup(ctx: AppContext, slug: string) {
    const group = await ctx.db.query.group.findFirst({
        where: eq(schema.group.slug, slug),
        columns: { slug: true, name: true, type: true },
    });

    if (!group || !isSelectableGroupType(group.type)) {
        throw HTTPAppException.BadRequest(`Ukjent gruppe: ${slug}`);
    }

    return group;
}

/**
 * The shared tail of every submission: claim the uploads, write the
 * attachment rows, render the PDF, and send the two emails.
 *
 * PDF failure is deliberately non-fatal. Losing a submitted utlegg because
 * one receipt was a malformed JPEG would be far worse than a missing PDF that
 * an admin can regenerate.
 */
async function finalizeApplication(
    ctx: AppContext,
    logger: LoggerType,
    applicationId: string,
    userId: string,
    attachmentKeys: string[],
    kind: ApplicationAttachmentKind,
): Promise<{ pdfGenerated: boolean }> {
    if (attachmentKeys.length > 0) {
        const claim = await claimAttachments(ctx, attachmentKeys, userId);
        if (!claim.ok) {
            // Roll the submission back — it has no attachments yet, and
            // cascading deletes take the detail row with it.
            await ctx.db
                .delete(schema.application)
                .where(eq(schema.application.id, applicationId));

            throw HTTPAppException.BadRequest(
                `Vedlegget «${claim.invalidKey}» finnes ikke, tilhører en annen bruker, eller er allerede brukt`,
            );
        }

        await ctx.db.insert(schema.applicationAttachment).values(
            attachmentKeys.map((assetKey, index) => ({
                applicationId,
                assetKey,
                kind,
                sortOrder: index,
            })),
        );
    }

    const application = await findApplicationById(ctx, applicationId);
    if (!application) {
        throw HTTPAppException.InternalError("Kunne ikke lagre søknaden");
    }

    let pdfGenerated = true;
    try {
        await generateApplicationPdf(ctx, application);
    } catch (error) {
        pdfGenerated = false;
        logger.error(
            { err: error, applicationId },
            "Failed to render application PDF; submission was kept",
        );
    }

    await notifyApplicationSubmitted(ctx, logger, application);

    return { pdfGenerated };
}

/** Insert the shared base row and return its id. */
async function insertBase(
    ctx: AppContext,
    type: ApplicationType,
    userId: string,
    contactName: string,
    contactEmail: string,
): Promise<string> {
    const signature = await buildSignature(ctx, userId);

    const [created] = await ctx.db
        .insert(schema.application)
        .values({
            type,
            submittedById: userId,
            contactName,
            contactEmail,
            signature,
        })
        .returning({ id: schema.application.id });

    if (!created) {
        throw HTTPAppException.InternalError("Kunne ikke opprette søknaden");
    }

    return created.id;
}

export const createExpenseRoute = route().post(
    "/expense",
    describeRoute({
        tags: ["applications"],
        summary: "Submit an expense claim",
        operationId: "createExpenseApplication",
        description:
            "Submit an utlegg. Any authenticated member may submit; the claim is handled by the Finansminister.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createApplicationResponseSchema,
            description: "Application submitted",
        })
        .badRequest({ description: "Unknown group or invalid attachment" })
        .unauthorized()
        .build(),
    requireAuth,
    validator("json", createExpenseApplicationSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const logger = c.get("logger");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const group = await requireGroup(ctx, body.groupSlug);

        // The CC is an allowlist, not free text: the old portal put whatever
        // the client sent straight onto an outbound mail. Only a real group's
        // conventional økonomiansvarlig address is accepted.
        if (body.ccEmail) {
            const ccGroup = await ctx.db.query.group.findFirst({
                where: eq(
                    schema.group.slug,
                    body.ccEmail
                        .replace(/^okonomiansvarlig\./, "")
                        .replace(/@tihlde\.org$/, ""),
                ),
                columns: { slug: true, type: true },
            });

            const isValidCc =
                ccGroup !== undefined &&
                isSelectableGroupType(ccGroup.type) &&
                financeEmailForGroup(ccGroup.slug) === body.ccEmail;

            if (!isValidCc) {
                throw HTTPAppException.BadRequest(
                    "Ugyldig kopiadresse — må være en gruppes økonomiansvarlig",
                );
            }
        }

        const id = await insertBase(
            ctx,
            "expense",
            user.id,
            body.contactName,
            body.contactEmail,
        );

        await ctx.db.insert(schema.applicationExpense).values({
            applicationId: id,
            ccEmail: body.ccEmail ?? null,
            amountNok: body.amountNok,
            expenseDate: body.expenseDate,
            groupSlug: group.slug,
            budgetType: body.budgetType,
            description: body.description,
            accountNumber: body.accountNumber,
        });

        const { pdfGenerated } = await finalizeApplication(
            ctx,
            logger,
            id,
            user.id,
            body.attachmentKeys,
            "receipt",
        );

        return c.json({ id, pdfGenerated }, 201);
    },
);

/**
 * Støttesøknader. `support` and `sports_support` share every field — they
 * differ only in who handles them — so one factory builds both routes.
 */
function createSupportRouteFor(
    type: Extract<ApplicationType, "support" | "sports_support">,
    config: {
        path: string;
        operationId: string;
        summary: string;
        description: string;
    },
) {
    return route().post(
        config.path,
        describeRoute({
            tags: ["applications"],
            summary: config.summary,
            operationId: config.operationId,
            description: config.description,
        })
            .schemaResponse({
                statusCode: 201,
                schema: createApplicationResponseSchema,
                description: "Application submitted",
            })
            .badRequest({ description: "Unknown group or invalid attachment" })
            .unauthorized()
            .build(),
        requireAuth,
        validator("json", createSupportApplicationSchema),
        async (c) => {
            const body = c.req.valid("json");
            const ctx = c.get("ctx");
            const logger = c.get("logger");
            const user = c.get("user");
            if (!user) throw HTTPAppException.Unauthorized();

            const group = await requireGroup(ctx, body.groupSlug);

            const id = await insertBase(
                ctx,
                type,
                user.id,
                body.contactName,
                body.contactEmail,
            );

            await ctx.db.insert(schema.applicationSupport).values({
                applicationId: id,
                groupSlug: group.slug,
                purpose: body.purpose,
                eventDescription: body.eventDescription,
                justification: body.justification,
                totalAmountNok: body.totalAmountNok,
                budgetLink: body.budgetLink ?? null,
                summary: body.summary ?? null,
            });

            const { pdfGenerated } = await finalizeApplication(
                ctx,
                logger,
                id,
                user.id,
                body.attachmentKeys,
                "budget",
            );

            return c.json({ id, pdfGenerated }, 201);
        },
    );
}

export const createSupportRoute = createSupportRouteFor("support", {
    path: "/support",
    operationId: "createSupportApplication",
    summary: "Apply for financial support",
    description:
        "Submit a søknad om støtte. Handled by the Finansminister and Hovedstyret.",
});

export const createSportsSupportRoute = createSupportRouteFor(
    "sports_support",
    {
        path: "/sports-support",
        operationId: "createSportsSupportApplication",
        summary: "Apply for sports club support",
        description:
            "Submit a søknad om støtte til idrettslag. Handled by IdKom.",
    },
);

export const createHsCaseRoute = route().post(
    "/hs-case",
    describeRoute({
        tags: ["applications"],
        summary: "Submit a case to Hovedstyret",
        operationId: "createHsCaseApplication",
        description:
            "Submit a sak til HS. A Vedtakssak must include a recommendation.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createApplicationResponseSchema,
            description: "Application submitted",
        })
        .badRequest({
            description: "Invalid attachment or missing innstilling",
        })
        .unauthorized()
        .build(),
    requireAuth,
    validator("json", createHsCaseApplicationSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const logger = c.get("logger");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const id = await insertBase(
            ctx,
            "hs_case",
            user.id,
            body.contactName,
            body.contactEmail,
        );

        await ctx.db.insert(schema.applicationHsCase).values({
            applicationId: id,
            caseName: body.caseName,
            caseType: body.caseType,
            background: body.background,
            assessment: body.assessment,
            recommendation: body.recommendation ?? null,
        });

        const { pdfGenerated } = await finalizeApplication(
            ctx,
            logger,
            id,
            user.id,
            body.attachmentKeys,
            "attachment",
        );

        return c.json({ id, pdfGenerated }, 201);
    },
);
