import type {
    AuthContext,
    MiddlewareContext,
    MiddlewareOptions,
    OAuth2Tokens,
    OAuth2UserInfo,
} from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import {
    account,
    group,
    groupMembership,
    studyProgram,
    studyProgramMembership,
} from "@photon/db/schema";
import { env } from "@photon/core/env";

/**
 * Database access required by the Feide sync hook.
 */
export type AuthCreateContext = {
    db: NodePgDatabase<DbSchema>;
};

/**
 * BetterAuth provider ID for Feide
 */
const FEIDE_PROVIDER_ID = "feide";

/**
 * Program codes from the Feide API that are part of TIHLDE
 */
const ALLOWED_PROGRAM_CODES = [
    "BIDATA",
    "ITBAITBEDR",
    "BDIGSEC",
    "ITMAIKTSA",
    "ITBAINFODR",
    "ITBAINFO",
] as const;

/**
 * Valid TIHLDE program codes
 */
type ProgramCode = (typeof ALLOWED_PROGRAM_CODES)[number];

/**
 * OpenID Profile returned by Dataporten/Feide
 *
 * Some fields not available based on membership type.
 * Only the fields defined below are guaranteed to be present.
 *
 * Docs: https://docs.feide.no/reference/apis/userinfo.html
 */
interface OpenIDProfile {
    /**
     * The internal ID of the authenticated user. This ID is stable but opaque, not releasing any additional information about the user. Always included.
     */
    sub: string;
    /**
     * The name of the authenticated user. Requires the userinfo-name attribute group.
     */
    name: string;
    /**
     * Email address of the authenticated user. Requires the email attribute group.
     */
    email: string;
}

/**
 * Feide group membership
 *
 * Docs: https://docs.feide.no/reference/apis/groups_api/groups_data_model.html
 */
interface FeideGroup {
    /**
     * The identifier of the group. The structure of the identifier depends on the group type.
     */
    id: string;
    /**
     * The group type. This is used to distinguish between different types of groups.
     */
    type: string;
    /**
     * The name of the group.
     */
    displayName: string;

    /**
     * parent and membership fields available, but omitted
     */
}

/**
 * Authentication plugin for Feide using OpenID Connect.
 *
 * The plugin is always registered so Better Auth's tuple-based `$Infer` (and
 * therefore the session/user type consumed across the API) stays stable. The
 * Feide *provider* is gated instead: without credentials the config list is
 * empty, so `/sign-in/oauth2` for `feide` simply resolves no provider and the
 * flow cannot start. A conditional spread in the plugins array would instead
 * widen the tuple and silently drop inferred fields like `banned`.
 */
export const feidePlugin = () =>
    genericOAuth({
        config:
            env.FEIDE_CLIENT_ID && env.FEIDE_CLIENT_SECRET
                ? [
                      {
                          providerId: FEIDE_PROVIDER_ID,
                          clientId: env.FEIDE_CLIENT_ID,
                          clientSecret: env.FEIDE_CLIENT_SECRET,
                          discoveryUrl:
                              "https://auth.dataporten.no/.well-known/openid-configuration",
                          scopes: [
                              "openid",
                              "userid",
                              "profile",
                              "groups-edu",
                              "email",
                          ],
                          getUserInfo,
                      },
                  ]
                : [],
    });

/**
 * Runs Feide tasks AFTER each auth request, to ensure synced info
 *
 * Important to note that this should run in the BetterAuth "after" hook
 * @param middlewareContext Middleware context
 */
export const syncFeideHook: (
    middlewareCtx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
            returned?: unknown;
            responseHeaders?: Headers;
        }
    >,
    ctx: AuthCreateContext,
) => Promise<void> = async (middlewareContext, ctx) => {
    if (
        middlewareContext.path.startsWith("/oauth2/callback") &&
        middlewareContext.params.providerId === FEIDE_PROVIDER_ID
    ) {
        const session = middlewareContext.context.newSession;
        if (!session) {
            throw new Error("No session found after Feide callback executed");
        }

        const userId = session.user.id;

        // Must filter by providerId: a user who also has an email/password
        // account has multiple `account` rows, and only the Feide one carries
        // the Dataporten access token needed below.
        const feideAccount = await ctx.db
            .select({ accessToken: account.accessToken })
            .from(account)
            .where(
                and(
                    eq(account.userId, userId),
                    eq(account.providerId, FEIDE_PROVIDER_ID),
                ),
            )
            .limit(1);

        const token = feideAccount[0]?.accessToken;

        if (!token) {
            throw new Error("No Feide account linked to user");
        }

        const groups = await fetchValidStudyPrograms(token);

        // Add user to all valid study programs
        await ctx.db.transaction(async (tx) => {
            for (const feideGroup of groups) {
                const sp = await tx
                    .select({ id: studyProgram.id, slug: studyProgram.slug })
                    .from(studyProgram)
                    .where(eq(studyProgram.feideCode, feideGroup.code))
                    .limit(1);

                if (!sp[0]) {
                    console.warn(
                        `User is part of unknown study program ${feideGroup}, skipping`,
                    );
                    continue;
                }

                const { id: studyProgramId, slug: programSlug } = sp[0];

                /**
                 * Additive by design: an existing row is left exactly as it
                 * is, start year included. Feide is asked with `showAll=true`
                 * so that graduating does not revoke access, and rewriting or
                 * deleting memberships here would undo that.
                 */
                await tx
                    .insert(studyProgramMembership)
                    .values({
                        userId,
                        studyProgramId,
                        startYear: feideGroup.startYear,
                    })
                    .onConflictDoNothing();

                await syncDerivedStudyGroups(
                    tx,
                    userId,
                    programSlug,
                    feideGroup.startYear,
                );
            }
        });
    }
};

/** The transaction handle `db.transaction` hands to its callback. */
type Transaction = Parameters<
    Parameters<NodePgDatabase<DbSchema>["transaction"]>[0]
>[0];

/**
 * Mirror a Feide study programme onto the two groups that represent it.
 *
 * TIHLDE models a member's studies twice: as a study programme (this table,
 * fed by Feide) and as a `study` plus a `studyyear` group. The groups are not
 * decoration — 252 of the 273 priority pools inherited from Lepton target
 * exactly those two types, so event registration priority breaks if they go
 * missing. Feide is the authority; the groups are a projection of it, and
 * nothing should edit them by hand.
 *
 * A study programme carries the same slug as its group, a convention the seed
 * in `apps/api/src/db/seed/org.ts` already establishes, so no lookup table is
 * needed.
 *
 * Additive like the membership above: leaving a programme never removes the
 * group, because "én gang TIHLDE-medlem, alltid TIHLDE-medlem".
 */
export async function syncDerivedStudyGroups(
    tx: Transaction,
    userId: string,
    programSlug: string,
    startYear: number,
): Promise<void> {
    const studyYearSlug = String(startYear);

    /**
     * Cohort groups are pure labels, so a missing one is created on the fly —
     * otherwise the first member of a new intake silently loses their year.
     * Study groups are deliberately *not* created here: those are curated,
     * carrying names, descriptions and images no code should invent.
     */
    await tx
        .insert(group)
        .values({
            slug: studyYearSlug,
            name: studyYearSlug,
            // Upper case to match the values already in the table; see the
            // note on `groupType`, which the column does not actually use.
            type: "STUDYYEAR",
            finesInfo: "",
            finesActivated: false,
        })
        .onConflictDoNothing();

    const existingGroups = await tx
        .select({ slug: group.slug })
        .from(group)
        .where(inArray(group.slug, [programSlug, studyYearSlug]));

    if (!existingGroups.some((g) => g.slug === programSlug)) {
        console.warn(
            `No group for study programme '${programSlug}'; skipping derived membership. Has the seed run?`,
        );
    }

    const memberships = existingGroups.map((g) => ({
        userId,
        groupSlug: g.slug,
        role: "member" as const,
    }));

    if (memberships.length > 0) {
        await tx
            .insert(groupMembership)
            .values(memberships)
            .onConflictDoNothing();
    }
}

interface StudyProgram {
    code: ProgramCode;
    startYear: number;
}

/**
 * Fetch all study programs of the user, that are part of TIHLDE
 * @param accessToken Access token with "groups-edu" scope
 */
async function fetchValidStudyPrograms(
    accessToken: string,
): Promise<StudyProgram[]> {
    // showAll=true includes all groups, even those that are not active
    // this follows the principle of "Én gang TIHLDE-medlem, alltid TIHLDE-medlem" to still provide access
    const response = await fetch(
        "https://groups-api.dataporten.no/groups/me/groups",
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
        throw new Error("Failed to fetch user groups");
    }

    const groups = (await response.json()) as FeideGroup[];
    return parseValidStudyPrograms(groups);
}

export function parseValidStudyPrograms(groups: FeideGroup[]): StudyProgram[] {
    return groups.flatMap((g) => {
        if (g.type !== "fc:fs:kull") return [];
        const parts = g.id.split(":"); // i.e. fc:fs:fs:kull:ntnu.no:BIDATA:2023H
        const programCode = parts[parts.length - 2]; // i.e. BIDATA
        const startYearRaw = parts[parts.length - 1]; // i.e. 2023H

        if (!programCode || !startYearRaw) return [];

        const startYear = Number.parseInt(startYearRaw.substring(0, 4));

        // Sanity check startyear between 2000 and 3000
        if (Number.isNaN(startYear) || startYear < 2000 || startYear > 3000) {
            throw new Error(
                `Invalid start year parsed from Feide: ${startYear}`,
            );
        }

        return ALLOWED_PROGRAM_CODES.filter((p) => p === programCode).map(
            (p) => ({
                code: p,
                startYear,
            }),
        );
    });
}

/**
 * Creates a User object from Feide OpenID profile
 * @param accessToken Access token with "openid" scope from Feide
 */
async function getUserInfo(tokens: OAuth2Tokens): Promise<OAuth2UserInfo> {
    if (!tokens.accessToken) {
        throw new Error("No access token provided");
    }

    const response = await fetch("https://auth.dataporten.no/openid/userinfo", {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch user info");
    }

    const profile = (await response.json()) as OpenIDProfile;

    return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        emailVerified: true,
        image: undefined,
    };
}
