import type {
    AuthContext,
    MiddlewareContext,
    MiddlewareOptions,
    OAuth2Tokens,
    OAuth2UserInfo,
} from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import type { Campus } from "@photon/db/schema";
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
type OpenIDProfile = {
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
};

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
                          /**
                           * Never create an account behind the member's back.
                           *
                           * A Feide login that matches no existing user is
                           * ambiguous: it is either a genuinely new member, or
                           * a member from Lepton whose stored username does not
                           * equal their NTNU one — 986 migrated members
                           * registered with a private address, so email cannot
                           * settle it either. Creating a user silently picks
                           * the first reading, and picking wrong strands that
                           * member's registrations, fines and roles on an
                           * account they can no longer reach.
                           *
                           * With implicit sign-up off, that login fails with
                           * `signup_disabled` instead, and the frontend asks
                           * the one question we cannot answer for them. Saying
                           * "I am new" replays the sign-in with
                           * `requestSignUp`, which creates the account exactly
                           * as before.
                           */
                          disableImplicitSignUp: true,
                          /**
                           * `userid` alone only buys the `userid_sec` claim
                           * itself — it arrives as an empty array unless the
                           * authorization request *also* asks for the
                           * attribute group that fills it. Feide's rule is
                           * that userinfo returns the intersection of what the
                           * client has authorized and what the request asks
                           * for, so having `userid-feide` enabled in
                           * Kundeportalen is not enough on its own.
                           *
                           * `groups-edu` below is the same pattern, and it is
                           * why groups worked while usernames did not: there
                           * the scope happens to carry the attribute group's
                           * own name.
                           */
                          scopes: [
                              "openid",
                              "userid",
                              "userid-feide",
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
            /**
             * The callback did NOT authenticate anyone — an expired or reused
             * state ("State mismatch: verification not found"), a denied
             * consent, a provider error. Better Auth has already produced its
             * own error response (and redirects to the sign-in's
             * errorCallbackURL when one was given); throwing here replaced
             * that with a bare 500 and an empty body, which is exactly what
             * users hit on photon.tihlde.org/api/auth/oauth2/callback/feide.
             * There is nothing to sync, so leave the response alone.
             */
            console.warn(
                "Feide callback finished without a session; skipping sync.",
            );
            return;
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

        const { programs, campus } = await fetchValidStudyPrograms(token);
        const { allowed, campusRejected } = partitionByCampus(programs, campus);

        if (needsCampusFollowUp(allowed, campus)) {
            /**
             * The user was let into a multi-campus programme without us being
             * able to tell which campus they attend — see partitionByCampus for
             * why that is allowed. Named here so the case can actually be
             * followed up on: the pure parser has no user to point at.
             */
            console.warn(
                `Could not resolve campus for user ${userId} (${session.user.username ?? "no username"}) on ${allowed.map((p) => p.code).join(", ")}; allowing.`,
            );
        }

        // Add user to all valid study programs
        await ctx.db.transaction(async (tx) => {
            /**
             * Campus only decides who gets *in*. A member whose reading came
             * out as another campus this semester — an exchange, or courses
             * taken at another campus — keeps the programme they already
             * belong to, so the gate can never take away access it once gave.
             */
            const groups = [
                ...allowed,
                ...(await keepExistingMemberships(
                    tx,
                    userId,
                    campusRejected,
                    session.user.username ?? null,
                )),
            ];

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
                        confirmedCampus: campus,
                    })
                    .onConflictDoNothing();

                await confirmCampus(tx, userId, studyProgramId, campus);

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
 * - Previously confirmed active, but no longer (a study-programme membership
 *   exists from an earlier login): assign "alumni", remove "member".
 * - Anything else: leave the baseline roles exactly as they are.
 *
 * That last case used to assign "alumni" on the strength of *any* group
 * membership, which read as "has a TIHLDE tie". Every member migrated from
 * Lepton has those, so an empty Feide result demoted them — and on
 * 2026-07-29 that hit a third-year student on ITBAITBEDR who is very much
 * active. An empty result is not evidence of graduation: it is equally
 * consistent with Feide not returning the programme at all, which is the open
 * question this same login exposed. Only a study-programme membership proves
 * we once saw them enrolled, so only that earns the demotion.
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
        // No row means we have never seen this member enrolled, so an empty
        // Feide result tells us nothing about whether they graduated. Leaving
        // the roles untouched is the only honest option.
        if (!studyHistory) return;
        target = "alumni";
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

/**
 * Record the campus a membership was seen at, if we do not already know one.
 *
 * Write-once: a confirmed campus is what earns permanent access to a
 * multi-campus programme, so it is only ever filled in, never rewritten. A
 * member who reads as Gjøvik during an exchange keeps the "trondheim" they
 * earned, and a row that predates this column — everyone migrated from Lepton
 * — fills in the first time we get a clear reading. A login with no resolvable
 * campus records nothing, which is the point: it is exactly the reading that
 * must not be able to earn anyone permanent access.
 *
 * Exported for testing.
 */
export async function confirmCampus(
    tx: Transaction,
    userId: string,
    studyProgramId: number,
    campus: Campus | null,
): Promise<void> {
    if (campus === null) return;

    await tx
        .update(studyProgramMembership)
        .set({ confirmedCampus: campus })
        .where(
            and(
                eq(studyProgramMembership.userId, userId),
                eq(studyProgramMembership.studyProgramId, studyProgramId),
                isNull(studyProgramMembership.confirmedCampus),
            ),
        );
}

/**
 * Of the programmes campus held back, the ones the member has already been
 * confirmed as a Trondheim student on.
 *
 * A membership row alone is not enough: it may have been created during a
 * login where campus could not be resolved at all, which is precisely the gap
 * a Gjøvik student can slip through. Only a recorded `confirmedCampus` of
 * "trondheim" — a semester's worth of Trondheim-coded courses actually seen in
 * Feide — earns the permanent access, and from then on a "Gjøvik" reading
 * means an exchange or a semester elsewhere, not that they stopped being a
 * TIHLDE member.
 *
 * Exported for testing.
 */
export async function keepExistingMemberships(
    tx: Transaction,
    userId: string,
    campusRejected: StudyProgram[],
    username: string | null,
): Promise<StudyProgram[]> {
    if (campusRejected.length === 0) return [];

    const confirmed = await tx
        .select({ code: studyProgram.feideCode })
        .from(studyProgramMembership)
        .innerJoin(
            studyProgram,
            eq(studyProgram.id, studyProgramMembership.studyProgramId),
        )
        .where(
            and(
                eq(studyProgramMembership.userId, userId),
                eq(studyProgramMembership.confirmedCampus, TIHLDE_CAMPUS),
            ),
        );

    const confirmedCodes = new Set(confirmed.map((c) => c.code));
    const kept = campusRejected.filter((p) => confirmedCodes.has(p.code));

    for (const p of campusRejected) {
        console.warn(
            confirmedCodes.has(p.code)
                ? `User ${userId} (${username ?? "no username"}) reads as another campus on ${p.code} but was confirmed in Trondheim earlier; keeping access.`
                : `User ${userId} (${username ?? "no username"}) rejected from ${p.code}: studies at another campus, never confirmed in Trondheim.`,
        );
    }

    return kept;
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
 * Split the programmes Feide reported into the ones campus lets through and
 * the ones it does not.
 *
 * NTNU runs BIDATA and BDIGSEC on several campuses under one code, so the code
 * alone would let Gjøvik- and Ålesund-students into TIHLDE. A programme is held
 * back only on *positive* evidence of another campus: an unresolved campus is
 * let through on purpose, because the alternative locks out a Trondheim student
 * whose FS course registrations have not landed yet — exactly the time of year
 * most new members sign up.
 *
 * This is an entry criterion, not a recurring one. Campus is re-derived from
 * whichever courses are active at each login, so a Trondheim student on
 * exchange, or one taking a semester at another campus, can well read as
 * "Gjøvik" halfway through their degree. The caller therefore only applies
 * `campusRejected` to programmes the user is not already a member of; see
 * {@link syncFeideHook}. "Én gang TIHLDE-medlem, alltid TIHLDE-medlem" holds
 * here as everywhere else — losing active studies makes you alumni, not a
 * stranger.
 *
 * Exported for testing.
 */
export function partitionByCampus(
    programs: StudyProgram[],
    campus: Campus | null,
): { allowed: StudyProgram[]; campusRejected: StudyProgram[] } {
    const rejects =
        campus !== null &&
        campus !== TIHLDE_CAMPUS &&
        ((p: StudyProgram) => MULTI_CAMPUS_PROGRAM_CODES.has(p.code));

    if (!rejects) return { allowed: programs, campusRejected: [] };

    return {
        allowed: programs.filter((p) => !rejects(p)),
        campusRejected: programs.filter(rejects),
    };
}

/**
 * Whether a login should be flagged for manual follow-up: the user was let
 * into a programme NTNU runs on several campuses, but their Feide groups did
 * not say which campus they attend. Exported for testing.
 */
export function needsCampusFollowUp(
    programs: StudyProgram[],
    campus: Campus | null,
): boolean {
    return (
        campus === null &&
        programs.some((p) => MULTI_CAMPUS_PROGRAM_CODES.has(p.code))
    );
}

/**
 * Fetch all study programs of the user, that are part of TIHLDE
 *
 * Returns the resolved campus alongside the programmes, so the caller — which
 * knows *who* logged in — can flag an unresolved one for follow-up.
 *
 * @param accessToken Access token with "groups-edu" scope
 */
async function fetchValidStudyPrograms(
    accessToken: string,
): Promise<{ programs: StudyProgram[]; campus: Campus | null }> {
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

    /**
     * An empty response is indistinguishable from "not a TIHLDE student" in
     * the data alone, but the two need very different fixes: one is a member
     * who graduated, the other is `groups-edu` not being released to the
     * service at all. Name the types we did get so the log can tell them
     * apart — a login that returns no groups whatsoever is a configuration
     * problem, not a graduation.
     */
    if (groups.length === 0) {
        console.warn(
            "Feide groups API returned no groups at all; is `groups-edu` released to this service?",
        );
    }

    const programs = parseValidStudyPrograms(groups);

    /**
     * Groups came back, but none of them read as a TIHLDE cohort. That is
     * either a member who really has finished studying, or a gap between what
     * Feide sends and what {@link parseValidStudyPrograms} expects — and the
     * two are indistinguishable in the data. Name the cohort groups we did
     * see, plus a tally of the other types, so one login settles it. Group ids
     * carry programme codes and years, not anything personal.
     */
    if (groups.length > 0 && programs.length === 0) {
        const cohorts = groups.filter((g) => g.type === "fc:fs:kull");
        const typeCounts = Object.entries(
            groups.reduce<Record<string, number>>((acc, g) => {
                acc[g.type] = (acc[g.type] ?? 0) + 1;
                return acc;
            }, {}),
        )
            .map(([type, count]) => `${type}×${count}`)
            .join(", ");

        console.warn(
            `Feide returned ${groups.length} groups but no TIHLDE cohort. Types: ${typeCounts}. Cohort ids: ${
                cohorts.map((g) => g.id).join(", ") || "(none)"
            }`,
        );
    }

    return {
        programs,
        campus: resolveCampus(groups),
    };
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

/**
 * The TIHLDE study programmes Feide reports for the user, by programme code
 * alone. Campus is a separate concern — see {@link partitionByCampus}.
 */
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
 * Describe the shape of every `userid_sec` claim Dataporten sent, without
 * putting the identifiers themselves in the log.
 *
 * Knowing the claim is *present* is not enough to explain why no username came
 * out of it: a JSON string reads as an iterable of single characters, so
 * {@link feideUsernameOf} would loop over letters and match nothing, and that
 * looks exactly like an array whose entries carry a prefix other than
 * `feide:`. Reporting the type, the length and the prefix before the first
 * colon separates the two, and a prefix is not personal data the way the
 * identifier after it is.
 *
 * Covers the two Dataporten-specific aliases as well as the standard claim,
 * since they are not documented to agree and a usable value may sit in one
 * while the one we read is empty.
 */
function describeUserIdClaims(profile: Record<string, unknown>): string {
    const keys = [
        "https://n.feide.no/claims/userid_sec",
        "dataporten-userid_sec",
        "connect-userid_sec",
    ];

    return keys
        .map((key) => {
            const raw = profile[key];
            if (raw === undefined) return `${key}: absent`;
            if (Array.isArray(raw)) {
                const prefixes = raw.map((v) => `${String(v).split(":")[0]}:…`);
                return `${key}: array(${raw.length}) [${prefixes.join(", ")}]`;
            }
            if (typeof raw === "string") {
                return `${key}: string(${raw.length}) "${raw.split(":")[0]}:…"`;
            }
            return `${key}: ${typeof raw}`;
        })
        .join("; ");
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

        /**
         * `userid_sec` is the only thing that ties a first-time Feide login to
         * a migrated member, and Feide drops it silently when the `userid`
         * scope is not released — no error, no empty field, just an absent
         * key. {@link resolveMigratedEmail} then returns null and Better Auth
         * mints a brand-new empty account while the member's history sits on
         * the old one. That failure is invisible in the data: the only trace
         * is a user row with no username, which reads exactly like a member
         * who never had one. Name the claims we actually received so one
         * login is enough to tell a missing scope from a missing member.
         */
        if (!feideUsernameOf(profile)) {
            console.warn(
                `Feide userinfo carried no usable userid_sec claim, so a migrated account cannot be matched by username. Claims received: ${Object.keys(profile).join(", ")}. ${describeUserIdClaims(profile)}`,
            );
        }

        const migratedEmail = await resolveMigratedEmail(db, profile);

        return {
            id: profile.sub,
            name: profile.name,
            email: migratedEmail ?? profile.email,
            emailVerified: true,
            image: undefined,
        };
    };
