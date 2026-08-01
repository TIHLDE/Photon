import { randomUUID } from "node:crypto";
import { schema } from "@photon/db";
import type { ApplicationType } from "@photon/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { getUserStudy } from "~/lib/user/study";
import { renderApplicationPdf } from "./pdf";
import type { ApplicationWithDetails } from "./types";

/** The relational `with` clause every detailed application read shares. */
const applicationWith = {
    expense: { with: { group: { columns: { slug: true, name: true } } } },
    support: { with: { group: { columns: { slug: true, name: true } } } },
    hsCase: true,
    companyContact: true,
    attachments: true,
    submittedBy: { columns: { id: true, name: true } },
    handledBy: { columns: { id: true, name: true } },
} as const;

export async function findApplicationById(
    ctx: AppContext,
    id: string,
): Promise<ApplicationWithDetails | null> {
    const application = await ctx.db.query.application.findFirst({
        where: eq(schema.application.id, id),
        with: applicationWith,
    });

    return (application as ApplicationWithDetails | undefined) ?? null;
}

export async function listApplications(
    ctx: AppContext,
    options: {
        types: ApplicationType[];
        status?: schema.ApplicationStatus;
        submittedById?: string;
        limit: number;
        offset: number;
    },
): Promise<ApplicationWithDetails[]> {
    if (options.types.length === 0) return [];

    const filters = [inArray(schema.application.type, options.types)];
    if (options.status) {
        filters.push(eq(schema.application.status, options.status));
    }
    if (options.submittedById) {
        filters.push(
            eq(schema.application.submittedById, options.submittedById),
        );
    }

    const rows = await ctx.db.query.application.findMany({
        where: and(...filters),
        with: applicationWith,
        orderBy: [desc(schema.application.createdAt)],
        limit: options.limit,
        offset: options.offset,
    });

    return rows as ApplicationWithDetails[];
}

/**
 * The signature line stamped into the PDF, e.g.
 * "brotherman: Dataingeniør - 2023".
 *
 * Derived from the session and the member's study groups. The old portal took
 * these values straight off the submitted form, which meant anyone could sign
 * as anyone; here the client cannot influence it. Falls back to just the
 * username when there is no study affiliation (alumni, honorary members).
 *
 * Reads the group projection rather than `studyProgramMembership` for the same
 * reason every other study read does — see {@link getUserStudy}. It used to
 * read the table, which has rows for 8 of 1707 members, so almost every
 * application was signed with a bare username; and it interpolated the year
 * unguarded, so the members who did have a row but no cohort were signed
 * "Digital Forretningsutvikling - null".
 */
export async function buildSignature(
    ctx: AppContext,
    userId: string,
): Promise<string> {
    const user = await ctx.db.query.user.findFirst({
        where: eq(schema.user.id, userId),
        columns: { username: true, name: true },
    });

    const label = user?.username ?? user?.name ?? userId;

    const { studyProgram, studyStartYear } = await getUserStudy(ctx, userId);

    if (!studyProgram) return label;

    // A programme with no cohort still says more than the username alone.
    if (studyStartYear === null) return `${label}: ${studyProgram}`;

    return `${label}: ${studyProgram} - ${studyStartYear}`;
}

/**
 * Render the PDF and store it as a private asset, returning its key.
 *
 * Callers treat a failure here as non-fatal: a submission must never be lost
 * because one attachment was malformed. `POST /:id/pdf/regenerate` is the
 * repair path.
 */
export async function generateApplicationPdf(
    ctx: AppContext,
    application: ApplicationWithDetails,
): Promise<string> {
    const pdf = await renderApplicationPdf(application, ctx.bucket);

    const key = `applications/${application.id}/${randomUUID()}.pdf`;
    await ctx.bucket.upload(key, pdf, {
        originalFilename: `soknad-${application.id}.pdf`,
        contentType: "application/pdf",
        uploadedById: application.submittedById ?? undefined,
        visibility: "private",
    });
    await ctx.bucket.promoteAsset(key);

    await ctx.db
        .update(schema.application)
        .set({ pdfAssetKey: key })
        .where(eq(schema.application.id, application.id));

    return key;
}

/**
 * Claim the staged assets a submission refers to.
 *
 * Verifies each key belongs to the submitting user and is still staged before
 * promoting it. Without this check a member could attach someone else's
 * staged upload to their own søknad and then read it back through the
 * authorized attachment route.
 */
export async function claimAttachments(
    ctx: AppContext,
    assetKeys: string[],
    userId: string,
): Promise<{ ok: true } | { ok: false; invalidKey: string }> {
    for (const key of assetKeys) {
        const asset = await ctx.bucket.getAsset(key);
        if (!asset || asset.uploadedById !== userId) {
            return { ok: false, invalidKey: key };
        }
        if (asset.status !== "staged") {
            return { ok: false, invalidKey: key };
        }
    }

    for (const key of assetKeys) {
        await ctx.bucket.promoteAsset(key);
    }

    return { ok: true };
}
