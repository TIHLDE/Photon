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
    role,
    studyProgram,
    studyProgramMembership,
    user,
    userRole,
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
 * The NTNU campuses relevant to TIHLDE's programmes.
 */
type Campus = "trondheim" | "gjovik" | "alesund";

/** TIHLDE only covers students in Trondheim. */
const TIHLDE_CAMPUS: Campus = "trondheim";

/**
 * Programmes NTNU runs on more than one campus under a *single* FS programme
 * code, and which therefore need a campus check on top of the code.
 *
 * BIDATA (Dataingeniør) runs in Trondheim, Gjøvik and Ålesund; BDIGSEC
 * (Digital infrastruktur og cybersikkerhet) in Trondheim and Gjøvik. The
 * remaining codes in ALLOWED_PROGRAM_CODES are Trondheim-only, so a campus
 * check would only add a way for them to break.
 */
const MULTI_CAMPUS_PROGRAM_CODES: ReadonlySet<string> = new Set([
    "BIDATA",
    "BDIGSEC",
]);

/**
 * Course-code stems whose next letter is NTNU's campus marker.
 *
 * NTNU gives the same course a separate code per campus, with the campus as
 * the last letter of the alphabetic stem: Programmering 1 is IDATT1003 in
 * Trondheim, IDATG1003 in Gjøvik and IDATA1003 in Ålesund. The same holds for
 * ING (fellesemner for ingeniørfag), IMA (matematikk), IST (statistikk), IFY
 * (fysikk), IELE (elektro) and DCS (cybersikkerhet) — all verified to exist in
 * all three (DCS: two) variants.
 *
 * Deliberately a fixed list, not a regex over any prefix: codes such as
 * TDT4127, EXPH0600, PROG1001 and HMS0002 end in letters that would otherwise
 * be misread as a campus.
 */
const CAMPUS_COURSE_STEMS = [
    "IDAT",
    "ING",
    "IMA",
    "IST",
    "IFY",
    "IELE",
    "DCS",
] as const;

const CAMPUS_BY_LETTER: Record<string, Campus> = {
    T: "trondheim",
    G: "gjovik",
    A: "alesund",
};

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
    /**
     * Secondary user identifiers, e.g. `["feide:mathstr@ntnu.no"]`. Requires
     * the userid scope. The local part is the NTNU username — the same value
     * Lepton stored as `user_id`, and therefore what the migration put in
     * `username`.
     */
    "https://n.feide.no/claims/userid_sec"?: string[];
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
export const feidePlugin = (db: NodePgDatabase<DbSchema>) =>
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
                          getUserInfo: createGetUserInfo(db),
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
                 * is, start year included. Feide only reports ACTIVE
                 * memberships, so graduating removes the group from the
                 * response — access history survives because rows are never
                 * rewritten or deleted here. Baseline roles (member/alumni)
                 * are what actually gate participation; see
                 * syncBaselineRoles.
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

            // Baseline roles follow the Feide result: active students get
            // "member", former members get "alumni", strangers get neither.
            await syncBaselineRoles(tx, userId, groups.length > 0);
        });
    }
};

/**
 * Keep a user's baseline RBAC role ("member" / "alumni") in sync with what
 * Feide reports at login.
 *
 * - Active student (Feide returned ≥1 TIHLDE study programme): assign
 *   "member", remove "alumni".
 * - Not active, but with TIHLDE history (a study-programme membership or any
 *   group membership — both additive, "én gang TIHLDE-medlem, alltid
 *   TIHLDE-medlem"): assign "alumni", remove "member".
 * - No TIHLDE tie (e.g. an NTNU student outside TIHLDE's programmes): remove
 *   both.
 *
 * No-ops for roles that don't exist yet (unseeded databases), so the login
 * flow never breaks on a missing role.
 */
export async function syncBaselineRoles(
    tx: Transaction,
    userId: string,
    isActiveStudent: boolean,
): Promise<void> {
    const baselineRoles = await tx
        .select({ id: role.id, name: role.name })
        .from(role)
        .where(inArray(role.name, ["member", "alumni"]));

    const memberRole = baselineRoles.find((r) => r.name === "member");
    const alumniRole = baselineRoles.find((r) => r.name === "alumni");
    if (!memberRole && !alumniRole) return;

    let target: "member" | "alumni" | null = null;
    if (isActiveStudent) {
        target = "member";
    } else {
        const [studyHistory] = await tx
            .select({ userId: studyProgramMembership.userId })
            .from(studyProgramMembership)
            .where(eq(studyProgramMembership.userId, userId))
            .limit(1);
        const [groupHistory] = studyHistory
            ? [studyHistory]
            : await tx
                  .select({ userId: groupMembership.userId })
                  .from(groupMembership)
                  .where(eq(groupMembership.userId, userId))
                  .limit(1);
        if (studyHistory || groupHistory) target = "alumni";
    }

    const assign = async (roleId: number) => {
        await tx
            .insert(userRole)
            .values({ userId, roleId })
            .onConflictDoNothing();
    };
    const remove = async (roleId: number) => {
        await tx
            .delete(userRole)
            .where(
                and(eq(userRole.userId, userId), eq(userRole.roleId, roleId)),
            );
    };

    if (target === "member") {
        if (memberRole) await assign(memberRole.id);
        if (alumniRole) await remove(alumniRole.id);
    } else if (target === "alumni") {
        if (alumniRole) await assign(alumniRole.id);
        if (memberRole) await remove(memberRole.id);
    } else {
        if (memberRole) await remove(memberRole.id);
        if (alumniRole) await remove(alumniRole.id);
    }
}

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
    // NOTE: no `show_all` param, so Dataporten only returns ACTIVE
    // memberships — an empty result for TIHLDE programmes means the user is
    // not an active student. Historic access is preserved anyway because the
    // membership rows below are additive ("Én gang TIHLDE-medlem, alltid
    // TIHLDE-medlem").
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

/**
 * The campus a course code belongs to, or null if the code does not carry a
 * campus marker. Exported for testing.
 */
export function campusOfCourseCode(courseCode: string): Campus | null {
    const match = /^([A-Z]+)\d/.exec(courseCode);
    const stem = match?.[1];
    if (!stem) return null;

    const family = stem.slice(0, -1);
    const letter = stem.slice(-1);

    if (!CAMPUS_COURSE_STEMS.some((s) => s === family)) return null;
    return CAMPUS_BY_LETTER[letter] ?? null;
}

/**
 * Work out which campus a student attends from their Feide groups.
 *
 * Feide has no campus field: neither the `kull` nor the `klasse` group carries
 * one, and a Gjøvik student on BIDATA gets the exact same
 * `fc:fs:fs:kull:ntnu.no:BIDATA:2025H` id as a Trondheim student. The course
 * groups do carry it, because NTNU codes each course per campus — see
 * {@link CAMPUS_COURSE_STEMS}. A first-semester student already has such
 * courses (INGx1002, IMAx1002, IDATx1003), so this works from day one of the
 * programme.
 *
 * Majority vote rather than first hit: a single course taken at another campus
 * should not move the student. A tie, or no campus-marked courses at all,
 * yields null — see {@link parseValidStudyPrograms} for what that means.
 *
 * Exported for testing.
 */
export function resolveCampus(groups: FeideGroup[]): Campus | null {
    const votes = new Map<Campus, number>();

    for (const g of groups) {
        if (g.type !== "fc:fs:emne") continue;
        // i.e. fc:fs:fs:emne:ntnu.no:IDATT2003:1
        const courseCode = g.id.split(":")[5];
        if (!courseCode) continue;

        const campus = campusOfCourseCode(courseCode);
        if (campus) votes.set(campus, (votes.get(campus) ?? 0) + 1);
    }

    let best: Campus | null = null;
    let bestCount = 0;
    let tied = false;

    for (const [campus, count] of votes) {
        if (count > bestCount) {
            best = campus;
            bestCount = count;
            tied = false;
        } else if (count === bestCount) {
            tied = true;
        }
    }

    return tied ? null : best;
}

export function parseValidStudyPrograms(groups: FeideGroup[]): StudyProgram[] {
    const campus = resolveCampus(groups);

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

        /**
         * NTNU runs BIDATA and BDIGSEC on several campuses under one code, so
         * the code alone would let Gjøvik- and Ålesund-students into TIHLDE.
         *
         * Rejected only on positive evidence of another campus. An unresolved
         * campus is let through on purpose: the alternative locks out a
         * Trondheim student whose FS course registrations have not landed yet,
         * at exactly the time of year most new members sign up. Should one slip
         * through, the next login re-runs this and drops their "member" role
         * (see syncBaselineRoles).
         */
        if (
            MULTI_CAMPUS_PROGRAM_CODES.has(programCode) &&
            campus !== null &&
            campus !== TIHLDE_CAMPUS
        ) {
            return [];
        }

        if (MULTI_CAMPUS_PROGRAM_CODES.has(programCode) && campus === null) {
            console.warn(
                `Could not resolve campus for multi-campus programme ${programCode}; allowing.`,
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
 * Extracts the NTNU username from a Feide profile: `feide:mathstr@ntnu.no`
 * becomes `mathstr`. Identical to the rule Lepton used when it set `user_id`,
 * which is what the migration stored as `username` — the whole point is that
 * the two derive the same value. Exported for testing.
 */
export function feideUsernameOf(profile: {
    "https://n.feide.no/claims/userid_sec"?: string[];
}): string | null {
    for (const id of profile["https://n.feide.no/claims/userid_sec"] ?? []) {
        if (id.startsWith("feide:")) {
            const local = id.slice("feide:".length).split("@")[0];
            if (local) return local.toLowerCase();
        }
    }
    return null;
}

/**
 * The email a migrated account should be resolved by, or null to use Feide's.
 *
 * Better Auth matches a first-time OAuth login to an existing user by email
 * alone. Most migrated members (996 of 1686) registered in Lepton with a
 * personal address, while Feide hands us their NTNU one — so the lookup misses
 * and they would get a second, empty account while their history sits on the
 * migrated one.
 *
 * Feide has already authenticated the NTNU username, and the migration stored
 * exactly that as `username`. When it names a user with no Feide link yet,
 * returning that user's stored email makes Better Auth's own email match land
 * on the right account. Exported for testing.
 *
 * Only accounts without an existing Feide link are considered: after the first
 * login the provider/sub pair identifies the user before email is consulted,
 * and the guard closes the edge where an old hand-picked Lepton username
 * happens to equal someone else's NTNU username.
 */
export async function resolveMigratedEmail(
    db: NodePgDatabase<DbSchema>,
    profile: OpenIDProfile,
): Promise<string | null> {
    const username = feideUsernameOf(profile);
    if (!username) {
        return null;
    }

    const [match] = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.username, username))
        .limit(1);

    if (!match) {
        return null;
    }

    const [feideLink] = await db
        .select({ id: account.id })
        .from(account)
        .where(
            and(
                eq(account.userId, match.id),
                eq(account.providerId, FEIDE_PROVIDER_ID),
            ),
        )
        .limit(1);

    return feideLink ? null : match.email;
}

/**
 * Creates the profile fetcher for the Feide provider.
 *
 * Needs the database because a first-time login may belong to a migrated
 * member: see {@link resolveMigratedEmail}.
 */
const createGetUserInfo =
    (db: NodePgDatabase<DbSchema>) =>
    async (tokens: OAuth2Tokens): Promise<OAuth2UserInfo> => {
        if (!tokens.accessToken) {
            throw new Error("No access token provided");
        }

        const response = await fetch(
            "https://auth.dataporten.no/openid/userinfo",
            {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            },
        );

        if (!response.ok) {
            throw new Error("Failed to fetch user info");
        }

        const profile = (await response.json()) as OpenIDProfile;

        const migratedEmail = await resolveMigratedEmail(db, profile);

        return {
            id: profile.sub,
            name: profile.name,
            email: migratedEmail ?? profile.email,
            emailVerified: true,
            image: undefined,
        };
    };
