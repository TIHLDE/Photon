import type {
    AuthContext,
    MiddlewareContext,
    MiddlewareOptions,
    OAuth2Tokens,
    OAuth2UserInfo,
} from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import type { Campus, StudyYearSource } from "@photon/db/schema";
import {
    account,
    group,
    groupMembership,
    role,
    session,
    studyProgram,
    studyProgramMembership,
    user,
    userRole,
} from "@photon/db/schema";
import { env } from "@photon/core/env";
import {
    currentAcademicYear,
    isMasterStudySlug,
    programmeLength,
} from "./academic-year";

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
 * BetterAuth provider ID for the email/password login it manages itself.
 */
const CREDENTIAL_PROVIDER_ID = "credential";

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
 * Re-exported so callers that already import from this module keep working.
 * The implementation lives in `academic-year.ts`, which kvark shares.
 */
export { currentAcademicYear };

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
     * The caller's membership in this group. Present on the FS groups we care
     * about; `active` is what separates a member still enrolled from one whose
     * membership has lapsed, and it is the only signal that survives
     * `showAll=true`.
     */
    membership?: {
        basic?: string;
        active?: boolean;
        displayName?: string;
        fsroles?: string[];
    };

    /**
     * parent field available, but omitted
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
             * No *new* session, which happens for two very different reasons.
             *
             * The callback may have failed to authenticate anyone — an expired
             * or reused state ("State mismatch: verification not found"), a
             * denied consent, a provider error. Better Auth has already
             * produced its own error response (and redirects to the sign-in's
             * errorCallbackURL when one was given); throwing here replaced
             * that with a bare 500 and an empty body, which is exactly what
             * users hit on photon.tihlde.org/api/auth/oauth2/callback/feide.
             *
             * Or this was an account *link*, where the member was already
             * signed in. Better Auth's link branch writes the account row and
             * redirects without ever calling `setSessionCookie`, so there is
             * no new session by construction — and this hook has no way to
             * learn who was linked. Five members reached exactly this state in
             * production on 2026-07-30: linked, but with no study programme,
             * campus or cohort until they signed in with Feide again.
             *
             * The link case is therefore finished off from the outside, by
             * `/koble-feide` calling the account-link sync endpoint, which runs
             * {@link syncFeideForUser} for the session it does have.
             */
            console.warn(
                "Feide callback finished without a new session; skipping sync. If this was an account link, /koble-feide completes it.",
            );
            return;
        }

        await syncFeideForUser(ctx.db, session.user.id);
    }
};

/**
 * Raised when the user has no Feide account to read study data from.
 *
 * Its own type because the callers treat it as an expected outcome rather than
 * a fault: the sync endpoint answers "you have not linked Feide yet", which is
 * a different thing from Dataporten being unreachable.
 */
export class NoFeideAccountError extends Error {
    constructor() {
        super("No Feide account linked to user");
        this.name = "NoFeideAccountError";
    }
}

/**
 * Bring a user's study programme, groups and baseline role in line with what
 * Feide reports, using the access token stored on their Feide account.
 *
 * Extracted from {@link syncFeideHook} so the account-link flow can run the
 * exact same work: linking produces no new session, so the hook cannot see who
 * to sync, while the page the member lands on afterwards can.
 */
export async function syncFeideForUser(
    db: AuthCreateContext["db"],
    userId: string,
): Promise<void> {
    /**
     * Must filter by providerId: a user who also has an email/password account
     * has multiple `account` rows, and only the Feide one carries the
     * Dataporten access token needed below.
     *
     * The username comes along for the ride purely so the warnings further
     * down can name who they are about — worth the join, because those
     * warnings are the only trace of a member who was let in without a
     * resolved campus.
     */
    const [feideAccount] = await db
        .select({ accessToken: account.accessToken, username: user.username })
        .from(account)
        .innerJoin(user, eq(user.id, account.userId))
        .where(
            and(
                eq(account.userId, userId),
                eq(account.providerId, FEIDE_PROVIDER_ID),
            ),
        )
        .limit(1);

    const token = feideAccount?.accessToken;

    if (!token) {
        throw new NoFeideAccountError();
    }

    const username =
        feideAccount.username ?? (await backfillUsername(db, userId, token));

    const who = `user ${userId} (${username ?? "no username"})`;

    const { programs, campus } = await fetchValidStudyPrograms(token, who);
    const { allowed, campusRejected } = partitionByCampus(programs, campus);

    /**
     * A login that ends with no programme leaves the member with no study, no
     * cohort and no groups — the state five members were sitting in when the
     * immatrikuleringsball registrations went out. Every route into it already
     * logs, but each logs something different and two of them name nobody, so
     * finding who it happened to meant correlating timestamps against
     * `auth_account.created_at` by hand.
     *
     * One line, always the same wording, always with the user in it. It is the
     * query an admin needs: who came out of a Feide login empty, and did their
     * programme come back from Feide at all or did our own campus gate hold it
     * back.
     */
    if (allowed.length === 0) {
        console.warn(
            `Feide login left ${who} without a study programme. Feide sent: ${
                programs.map((p) => p.code).join(", ") ||
                "(no TIHLDE programme)"
            }. Held back by campus: ${
                campusRejected.map((p) => p.code).join(", ") || "(none)"
            }. Campus read as: ${campus ?? "unresolved"}.`,
        );
    }

    if (needsCampusFollowUp(allowed, campus)) {
        /**
         * The user was let into a multi-campus programme without us being
         * able to tell which campus they attend — see partitionByCampus for
         * why that is allowed. Named here so the case can actually be
         * followed up on: the pure parser has no user to point at.
         */
        console.warn(
            `Could not resolve campus for ${who} on ${allowed.map((p) => p.code).join(", ")}; allowing.`,
        );
    }

    await applyFeideStudyPrograms(
        db,
        userId,
        allowed,
        campusRejected,
        campus,
        username,
    );
}

/**
 * Run the Feide sync again for a member who came out of a login without a
 * baseline role.
 *
 * The sync in the callback is best-effort by design: it runs after the session
 * cookie is set, so throwing there would hand a logged-in member a 500 instead
 * of the website. The cost, spelled out in that comment, is that a failed sync
 * leaves them without a baseline role "until the next login" — and nothing ever
 * checked at the next login either. They stay signed in, permission-less, and
 * find out when they press "Meld deg på": on 2026-08-21 a member hit exactly
 * that at the immatrikuleringsball, on a session from two weeks earlier, and
 * the only cure was to guess that logging out and in again would help.
 *
 * Every new session is the natural place to notice. The check is one indexed
 * lookup for the overwhelming majority who already have a role, and the repair
 * only runs for those who do not.
 *
 * Silent for members who simply have no Feide account — a self-registered
 * account with no role is not broken, it is waiting for approval.
 */
export async function recoverMissingBaselineRole(
    db: AuthCreateContext["db"],
    userId: string,
): Promise<void> {
    const [existing] = await db
        .select({ roleId: userRole.roleId })
        .from(userRole)
        .innerJoin(role, eq(role.id, userRole.roleId))
        .where(
            and(
                eq(userRole.userId, userId),
                inArray(role.name, ["member", "alumni"]),
            ),
        )
        .limit(1);

    if (existing) return;

    const [feideAccount] = await db
        .select({ id: account.id })
        .from(account)
        .where(
            and(
                eq(account.userId, userId),
                eq(account.providerId, FEIDE_PROVIDER_ID),
            ),
        )
        .limit(1);

    if (!feideAccount) return;

    console.warn(
        `User ${userId} signed in without a baseline role; retrying the Feide sync.`,
    );

    await syncFeideForUser(db, userId);
}

/**
 * Write a parsed Feide result to the database.
 *
 * Split out from {@link syncFeideForUser} so the integration tests can drive
 * the exact sequence a real callback runs while choosing the payload, instead
 * of reimplementing it. They used to reimplement it, and the copy silently
 * stopped matching the moment this file changed — a test asserting the old
 * behaviour kept passing against code that no longer did it.
 *
 * Exported for testing.
 */
export async function applyFeideStudyPrograms(
    db: AuthCreateContext["db"],
    userId: string,
    allowed: StudyProgram[],
    campusRejected: StudyProgram[],
    campus: Campus | null,
    username: string | null,
    now = new Date(),
): Promise<void> {
    // Add user to all valid study programs
    await db.transaction(async (tx) => {
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
                username,
            )),
        ];

        /**
         * Read once, before the loop, and deliberately not re-read inside it.
         * The loop creates cohort groups as it goes, so a per-programme lookup
         * would see a different set depending on which order Feide happened to
         * list the programmes in — a transfer from Dataingeniør into Digital
         * forretningsutvikling would land in one intake or two purely by
         * accident of ordering. There is a regression test for exactly this.
         */
        const existingCohortYears = await readCohortYears(tx, userId);

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
             * NTNU does not issue `fc:fs:kull` for every programme. Neither
             * ITBAITBEDR nor the master ever gets one — 0 of 217 rows in
             * production between them — so for those two a year we work out
             * ourselves is not a stopgap until FS improves, it is the only
             * source there will ever be. Leaving it empty costs the member
             * priority on everything aimed at their own intake.
             */
            const derivedStartYear =
                feideGroup.startYear === null
                    ? await deriveStartYear(
                          tx,
                          userId,
                          programSlug,
                          existingCohortYears,
                          feideGroup.active,
                          now,
                      )
                    : null;

            const startYear = feideGroup.startYear ?? derivedStartYear;

            const startYearSource: StudyYearSource | null =
                feideGroup.startYear !== null
                    ? "feide"
                    : derivedStartYear !== null
                      ? "derived"
                      : null;

            const [before] = await tx
                .select({
                    startYear: studyProgramMembership.startYear,
                    startYearSource: studyProgramMembership.startYearSource,
                })
                .from(studyProgramMembership)
                .where(
                    and(
                        eq(studyProgramMembership.userId, userId),
                        eq(
                            studyProgramMembership.studyProgramId,
                            studyProgramId,
                        ),
                    ),
                )
                .limit(1);

            /**
             * A stored year is replaced only by one from a source that
             * outranks it, and the comparison lives in SQL rather than here so
             * no future caller can update a year it should not.
             *
             * This replaced a hand-written special case that only ever let
             * `feide` overwrite `assumed`. That phrasing had a hole: a row
             * that already existed with a NULL source could never be filled,
             * whatever we learned later, which is how 153 rows in production —
             * both of them on every member who had continued onto the master —
             * ended up permanently without a year.
             *
             * Equal ranks do not overwrite, so the first answer of a given
             * quality stands. That is what keeps a login from re-deriving over
             * the more accurate year the backfill worked out from a member's
             * cohort group.
             */
            const [written] = await tx
                .insert(studyProgramMembership)
                .values({
                    userId,
                    studyProgramId,
                    startYear,
                    startYearSource,
                    confirmedCampus: campus,
                })
                .onConflictDoUpdate({
                    target: [
                        studyProgramMembership.userId,
                        studyProgramMembership.studyProgramId,
                    ],
                    set: {
                        startYear: sql`excluded.start_year`,
                        startYearSource: sql`excluded.start_year_source`,
                    },
                    setWhere: sql`
                        excluded.start_year IS NOT NULL
                        AND ${startYearSourceRank(sql`excluded.start_year_source`)}
                          > ${startYearSourceRank(studyProgramMembership.startYearSource)}
                    `,
                })
                .returning({
                    startYear: studyProgramMembership.startYear,
                    startYearSource: studyProgramMembership.startYearSource,
                });

            /**
             * No row back means the guard rejected our values, so what is
             * already stored stands. Deriving the groups from the stored year
             * rather than from Feide's is what keeps a `manual` correction
             * from being silently undone on the member's next login.
             */
            const stored = written ?? before;
            const effectiveStartYear = stored?.startYear ?? null;

            /**
             * Never for a master: masters own no cohort group, so the only
             * group slugged with that year belongs to the member's bachelor,
             * and deleting it would take their real intake with it.
             */
            if (
                before?.startYearSource === "derived" &&
                before.startYear !== null &&
                before.startYear !== effectiveStartYear &&
                !isMasterStudySlug(programSlug)
            ) {
                await removeCohortMembership(tx, userId, before.startYear);
            }

            /**
             * Record what Feide just said about enrolment, unconditionally
             * and in its own statement.
             *
             * It cannot ride along on the upsert above: that one is guarded by
             * `setWhere` so a stored year is never overwritten, and an active
             * flag that only updated when the year happened to be upgradeable
             * would freeze on the day someone's cohort was settled. This is
             * the opposite kind of value — always the latest reading wins,
             * both ways round, so graduating clears it as readily as
             * re-enrolling sets it.
             */
            await tx
                .update(studyProgramMembership)
                .set({
                    feideActive: feideGroup.active,
                    feideCheckedAt: now,
                })
                .where(
                    and(
                        eq(studyProgramMembership.userId, userId),
                        eq(
                            studyProgramMembership.studyProgramId,
                            studyProgramId,
                        ),
                    ),
                );

            await confirmCampus(tx, userId, studyProgramId, campus);

            await syncDerivedStudyGroups(
                tx,
                userId,
                programSlug,
                effectiveStartYear,
            );

            await syncProgrammeLinkedGroups(tx, {
                userId,
                studyProgramId,
                programSlug,
                active: feideGroup.active,
                startYear: effectiveStartYear,
                now,
            });
        }

        /**
         * Baseline roles follow the Feide result: active students get
         * "member", former members get "alumni", strangers get neither.
         *
         * Keyed on `active`, not on how many groups came back. With
         * `showAll=true` a member who finished years ago still has their
         * old groups in the response, so counting groups would call
         * everyone an active student forever.
         */
        await syncBaselineRoles(
            tx,
            userId,
            groups.some((g) => g.active),
        );
    });
}

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

        /**
         * Feide answers the question an admin would otherwise have to: this is
         * an active student on a TIHLDE programme. Someone who signed up on the
         * website and only later logged in with Feide should not be left
         * sitting in the approval queue after that.
         *
         * Only ever moves pending -> approved, so an account that never needed
         * approving keeps its null and stays out of the queue's history.
         */
        await tx
            .update(user)
            .set({ approvalStatus: "approved", approvedAt: new Date() })
            .where(
                and(eq(user.id, userId), eq(user.approvalStatus, "pending")),
            );
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
 * Rank of a cohort year's source, as SQL. Higher wins; NULL ranks lowest.
 *
 * `manual` is a deliberate correction by the board and outranks everything,
 * `feide` is what NTNU says, `migrated` is the real year Lepton carried over,
 * and `derived` is the one we worked out ourselves. A NULL source means a row
 * that never resolved a year at all, so anything beats it.
 */
function startYearSourceRank(source: SQL | AnyColumn): SQL<number> {
    return sql<number>`(CASE ${source}
        WHEN 'manual' THEN 4
        WHEN 'feide' THEN 3
        WHEN 'migrated' THEN 2
        WHEN 'derived' THEN 1
        ELSE 0
    END)`;
}

/**
 * The intake year we believe a member started a programme in, when Feide will
 * not tell us.
 *
 * Two signals, in order of how much they are worth:
 *
 * 1. **The member's cohort group.** Migrated from Lepton, it holds the real
 *    intake, and it is exact rather than inferred. Only when there is exactly
 *    one: a member who transferred carries two, and picking between them here
 *    would be a guess dressed up as a lookup. Never for a master — the cohort
 *    group belongs to the member's *bachelor*, and reading it here is precisely
 *    the confusion that made a first-year master indistinguishable from a
 *    third-year bachelor.
 * 2. **When we first saw them on the programme**, from the study group's
 *    `created_at`. Checked against the 314 rows where Feide did supply a year:
 *    282 exact, 21 out by a year, 7 by more. Good enough to be the only source
 *    two programmes will ever have, not good enough to override signal 1.
 *
 * Falls back to the current intake when neither exists, which is the right
 * answer for the case that produces it: a member appearing on a programme for
 * the first time, in the middle of the admission they were just admitted in.
 *
 * That last fallback is withheld from an inactive membership. With
 * `showAll=true` an alumnus still arrives with their old groups, and stamping
 * them with this year's intake would file someone who finished long ago as a
 * fresh first-year.
 */
async function readCohortYears(
    tx: Transaction,
    userId: string,
): Promise<number[]> {
    const rows = await tx
        .select({ slug: groupMembership.groupSlug })
        .from(groupMembership)
        .innerJoin(group, eq(group.slug, groupMembership.groupSlug))
        .where(
            and(
                eq(groupMembership.userId, userId),
                // Type is a varchar holding upper-case values from Lepton, not
                // the `groupType` enum; compare case-insensitively.
                sql`upper(${group.type}) = 'STUDYYEAR'`,
            ),
        );

    return rows
        .map((row) => Number.parseInt(row.slug, 10))
        .filter((year) => Number.isFinite(year));
}

async function deriveStartYear(
    tx: Transaction,
    userId: string,
    programSlug: string,
    cohortYears: readonly number[],
    active: boolean,
    now: Date,
): Promise<number | null> {
    if (!isMasterStudySlug(programSlug) && cohortYears.length === 1) {
        return cohortYears[0] as number;
    }

    const [membership] = await tx
        .select({ createdAt: groupMembership.createdAt })
        .from(groupMembership)
        .where(
            and(
                eq(groupMembership.userId, userId),
                eq(groupMembership.groupSlug, programSlug),
            ),
        )
        .limit(1);

    /**
     * The study group is created later in this same transaction, by
     * {@link syncDerivedStudyGroups}, so on a member's first login with this
     * programme there is deliberately nothing to read here yet.
     */
    if (membership) return currentAcademicYear(membership.createdAt);

    return active ? currentAcademicYear(now) : null;
}

/**
 * Drop the cohort group a superseded guess put the member in.
 *
 * {@link syncDerivedStudyGroups} only ever adds, on purpose — leaving a
 * programme should never cost someone their history. A guessed cohort is the
 * one exception: once Feide tells us the real intake, the guess is not history,
 * it is a wrong answer, and leaving it would keep the member in two intakes
 * with `Math.max()` picking whichever is higher.
 *
 * Matched on slug alone: cohort groups are the only ones slugged as a bare
 * year, and `syncDerivedStudyGroups` is what created this one.
 */
async function removeCohortMembership(
    tx: Transaction,
    userId: string,
    year: number,
): Promise<void> {
    await tx
        .delete(groupMembership)
        .where(
            and(
                eq(groupMembership.userId, userId),
                eq(groupMembership.groupSlug, String(year)),
            ),
        );
}

/**
 * Semester registration windows, when `feideActive = false` says nothing.
 *
 * NTNU flips the flag off for a student who has not registered for the term
 * yet, and the deadline falls around 1 September and 1 February. In those weeks
 * "inactive" is indistinguishable from "registers next week", so nothing is
 * taken away from anyone inside them.
 *
 * Month is zero-indexed.
 */
function inRegistrationWindow(now: Date): boolean {
    const month = now.getMonth();
    const day = now.getDate();
    const autumn = month === 7 || (month === 8 && day <= 15);
    const spring = month === 0 || (month === 1 && day <= 15);
    return autumn || spring;
}

/**
 * Whether Feide's "not enrolled" is safe to act on.
 *
 * `membership.active = false` carries at least four meanings: finished, quit,
 * on leave, on exchange, and — most often in August — simply not registered for
 * the term yet. Feide offers nothing that tells them apart, and three of those
 * people keep their study right and should keep their place.
 *
 * What does tell them apart is where the member is in the programme. Of the 30
 * inactive rows in production, 26 are past the length of their degree and 4 are
 * in their second or third year of a three-year bachelor. The 26 read as
 * finished; the 4 read as anything but. So the flag is only acted on once the
 * member is past the programme's own length, which leaves exchange, leave and
 * late registration untouched — they are all, by definition, still inside it.
 *
 * The cost is that someone who genuinely drops out mid-degree keeps their place
 * until their nominal end year. For a private group with a roster its leader can
 * edit, that is the forgiving direction, and the forgiving direction is the
 * right one when the alternative is throwing out students who never left.
 */
function hasFinishedProgramme(
    programSlug: string,
    startYear: number | null,
    now: Date,
): boolean {
    // No year, no verdict: we cannot place them in the programme at all.
    if (startYear === null) return false;
    if (inRegistrationWindow(now)) return false;

    return (
        currentAcademicYear(now) - startYear + 1 > programmeLength(programSlug)
    );
}

/**
 * Keep the roster of a programme's own private group in step with enrolment.
 *
 * A study programme may run one private group for its students — today only
 * Digital transformasjon does, and `org_group.study_program_id` is what links
 * them. Membership follows enrolment in both directions: an active student is
 * enrolled on login regardless of cohort, and a member Feide reports as
 * finished is removed.
 *
 * Removal is deliberately hard to trigger; see {@link hasFinishedProgramme}.
 * Being reported inactive is not enough on its own, because most of the people
 * that describes have not gone anywhere.
 */
async function syncProgrammeLinkedGroups(
    tx: Transaction,
    params: {
        userId: string;
        studyProgramId: number;
        programSlug: string;
        active: boolean;
        startYear: number | null;
        now: Date;
    },
): Promise<void> {
    const { userId, studyProgramId, programSlug, active, startYear, now } =
        params;

    const linked = await tx
        .select({ slug: group.slug, finesAdminId: group.finesAdminId })
        .from(group)
        .where(eq(group.studyProgramId, studyProgramId));

    if (linked.length === 0) return;

    for (const linkedGroup of linked) {
        if (active) {
            await tx
                .insert(groupMembership)
                .values({
                    userId,
                    groupSlug: linkedGroup.slug,
                    role: "member",
                })
                .onConflictDoNothing();
            continue;
        }

        if (!hasFinishedProgramme(programSlug, startYear, now)) continue;

        await removeFromProgrammeGroup(tx, {
            userId,
            groupSlug: linkedGroup.slug,
            finesAdminId: linkedGroup.finesAdminId,
            studyProgramId,
        });
    }
}

/**
 * Take a member out of a programme's private group, and hand on what they held.
 *
 * A group without a leader has nobody who can edit its roster, which for a
 * private group means nobody can let anyone back in. So the roles do not simply
 * vanish with the person: the leadership passes to an active student, and the
 * botsjef role follows the leadership.
 *
 * The successor is the most senior active student left — the earliest intake,
 * which is the highest class level. Ties go to whoever has been in the group
 * longest, then to the lowest user id so the outcome never depends on the order
 * Postgres returns rows in. Only active students are eligible: handing the group
 * to someone who has also finished would just move the problem.
 *
 * Nothing is handed on when no active student remains. The group keeps the
 * leader and botsjef it has, stale as they are, because an empty leadership is
 * strictly worse than an absent one — and a human can still fix it.
 */
async function removeFromProgrammeGroup(
    tx: Transaction,
    params: {
        userId: string;
        groupSlug: string;
        finesAdminId: string | null;
        studyProgramId: number;
    },
): Promise<void> {
    const { userId, groupSlug, finesAdminId, studyProgramId } = params;

    const [leaving] = await tx
        .select({ role: groupMembership.role })
        .from(groupMembership)
        .where(
            and(
                eq(groupMembership.userId, userId),
                eq(groupMembership.groupSlug, groupSlug),
            ),
        )
        .limit(1);

    // Not a member of this group, so there is nothing to remove or hand on.
    if (!leaving) return;

    const wasLeader = leaving.role === "leader";
    const wasFinesAdmin = finesAdminId === userId;

    await tx
        .delete(groupMembership)
        .where(
            and(
                eq(groupMembership.userId, userId),
                eq(groupMembership.groupSlug, groupSlug),
            ),
        );

    if (!wasLeader && !wasFinesAdmin) return;

    /**
     * The leader as it stands after the removal: unchanged when someone else
     * holds it, and about to be filled when the person leaving held it.
     */
    let leaderId: string | null = null;

    if (wasLeader) {
        const [successor] = await tx
            .select({ userId: groupMembership.userId })
            .from(groupMembership)
            .innerJoin(
                studyProgramMembership,
                and(
                    eq(studyProgramMembership.userId, groupMembership.userId),
                    eq(studyProgramMembership.studyProgramId, studyProgramId),
                ),
            )
            .where(
                and(
                    eq(groupMembership.groupSlug, groupSlug),
                    eq(studyProgramMembership.feideActive, true),
                ),
            )
            .orderBy(
                sql`${studyProgramMembership.startYear} asc nulls last`,
                groupMembership.createdAt,
                groupMembership.userId,
            )
            .limit(1);

        if (successor) {
            await tx
                .update(groupMembership)
                .set({ role: "leader" })
                .where(
                    and(
                        eq(groupMembership.userId, successor.userId),
                        eq(groupMembership.groupSlug, groupSlug),
                    ),
                );
            leaderId = successor.userId;
        }
    } else {
        const [current] = await tx
            .select({ userId: groupMembership.userId })
            .from(groupMembership)
            .where(
                and(
                    eq(groupMembership.groupSlug, groupSlug),
                    eq(groupMembership.role, "leader"),
                ),
            )
            .limit(1);
        leaderId = current?.userId ?? null;
    }

    // The botsjef role follows the leadership, but only where there is one to
    // follow: leaving a group with no botsjef at all would take its fines with
    // it, and those are the members' own.
    if (wasFinesAdmin && leaderId) {
        await tx
            .update(group)
            .set({ finesAdminId: leaderId })
            .where(eq(group.slug, groupSlug));
    }
}

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
    startYear: number | null,
): Promise<void> {
    /**
     * No cohort group when the year is unknown. Feide gives a year only via
     * `fc:fs:kull`, and a member can have the programme without ever having
     * had a cohort — inventing a year would put them in the wrong intake, and
     * the cohort groups are what the inherited priority pools select on.
     *
     * And none for a master either, whatever year we hold. A cohort group is
     * programme-less — it is slugged as a bare year and says nothing about
     * *which* studies started then — so putting a master's intake in one mixes
     * master students into the inherited pools aimed at that year's bachelor
     * intake. The master's own start year lives on the programme row instead,
     * which is where {@link computeUserClassYear} now reads it, and the
     * bachelor cohort group the member already carries stays untouched as
     * history.
     */
    const studyYearSlug =
        startYear === null || isMasterStudySlug(programSlug)
            ? null
            : String(startYear);

    if (studyYearSlug !== null) {
        /**
         * Cohort groups are pure labels, so a missing one is created on the
         * fly — otherwise the first member of a new intake silently loses
         * their year. Study groups are deliberately *not* created here: those
         * are curated, carrying names, descriptions and images no code should
         * invent.
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
    }

    const wanted =
        studyYearSlug === null ? [programSlug] : [programSlug, studyYearSlug];

    const existingGroups = await tx
        .select({ slug: group.slug })
        .from(group)
        .where(inArray(group.slug, wanted));

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
    /**
     * Cohort start year, or null when Feide only gave us the programme group.
     * Only `fc:fs:kull` carries a year, and that group is not always present.
     */
    startYear: number | null;
    /**
     * Whether Feide still reports the membership as active. With
     * `showAll=true` the response includes lapsed memberships too, so this —
     * not the mere presence of a group — is what says "currently enrolled".
     */
    active: boolean;
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
    who: string,
): Promise<{ programs: StudyProgram[]; campus: Campus | null }> {
    /**
     * `showAll=true` is what makes cohorts visible at all.
     *
     * A `fc:fs:kull` membership is valid for a bounded period, so by third year
     * a student's cohort has lapsed and the default response — active
     * memberships only — leaves it out entirely. That is why every login in
     * production came back with a programme group and no cohort, and why no
     * member ever got a study programme or a cohort group.
     *
     * The cost is that lapsed memberships now come back too, so the mere
     * presence of a group no longer means "enrolled". `membership.active` on
     * each group carries that instead; see {@link parseValidStudyPrograms}.
     */
    const response = await fetch(
        "https://groups-api.dataporten.no/groups/me/groups?showAll=true",
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
            `Feide groups API returned no groups at all for ${who}; is \`groups-edu\` released to this service?`,
        );
    }

    const programs = parseValidStudyPrograms(groups);

    /**
     * Two different failures deserve the same dump of what Feide actually sent.
     *
     * No programme at all is either a member who really has finished studying
     * or a gap between what Feide sends and what {@link parseValidStudyPrograms}
     * expects — indistinguishable in the data.
     *
     * A programme with no start year is the one that matters now. 172 of the
     * priority pools inherited from Lepton select on the cohort group, so a
     * member without a year loses priority on every event aimed at their own
     * intake. Existing members are covered by the year Lepton migrated in, so
     * this only bites accounts created from scratch — i.e. the autumn intake.
     *
     * Until recently this branch was `programs.length === 0`, which stopped
     * firing the moment programme parsing started working: every login now
     * yields a programme, so the missing-year case logged nothing at all. That
     * left us blind precisely where we still have an open question.
     */
    const yearMissing =
        programs.length > 0 && programs.every((p) => p.startYear === null);

    if (groups.length > 0 && (programs.length === 0 || yearMissing)) {
        const cohorts = groups.filter((g) => g.type === "fc:fs:kull");
        const typeCounts = Object.entries(
            groups.reduce<Record<string, number>>((acc, g) => {
                acc[g.type] = (acc[g.type] ?? 0) + 1;
                return acc;
            }, {}),
        )
            .map(([type, count]) => `${type}×${count}`)
            .join(", ");

        /**
         * NTNU does not reliably hand this service `fc:fs:kull`: a third-year
         * ITBAITBEDR student came back with 18 `fc:fs:emne` and a single
         * `fc:fs:prg`, while a BIDATA alumnus did get a cohort. So dump every
         * non-course group whole — the id tells us where the programme code
         * sits, and `displayName` plus whatever `membership` holds is the only
         * place a year could still be hiding. Course groups are excluded
         * because there are ~18 of them and the type tally already counts them.
         */
        const nonCourse = groups.filter((g) => g.type !== "fc:fs:emne");

        const problem =
            programs.length === 0
                ? "no TIHLDE study programme"
                : `no cohort year for ${programs.map((p) => p.code).join(", ")}`;

        console.warn(
            `Feide returned ${groups.length} groups for ${who} but ${problem}. Types: ${typeCounts}. Cohort ids: ${
                cohorts.map((g) => g.id).join(", ") || "(none)"
            }. Non-course groups: ${
                JSON.stringify(nonCourse).slice(0, 2000) || "(none)"
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
 * Only *active* course memberships vote. We fetch groups with `showAll=true`,
 * so the response carries every course the member has ever been enrolled in,
 * and counting those equally lets a finished semester elsewhere outvote the
 * one they are in now. On 2026-08-17 that cost a first-year BDIGSEC student in
 * Trondheim his study programme, cohort and every group on the account: his
 * lapsed courses read as another campus, the gate held the programme back, and
 * the result was indistinguishable from Feide never having sent it.
 *
 * The activity filter is applied only when Feide actually says something about
 * activity. `membership.active` is documented as present on the FS groups, but
 * a response that omits it on courses would otherwise leave every login with
 * an empty ballot — campus null, gate open — which is the one failure this
 * function must not have. So: if no course carries the field, every course
 * votes, exactly as before.
 *
 * Exported for testing.
 */
export function resolveCampus(groups: FeideGroup[]): Campus | null {
    const courses = groups.filter((g) => g.type === "fc:fs:emne");

    const reportsActivity = courses.some(
        (g) => typeof g.membership?.active === "boolean",
    );

    const voters = reportsActivity
        ? courses.filter((g) => g.membership?.active === true)
        : courses;

    const votes = new Map<Campus, number>();

    for (const g of voters) {
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

/** The programme codes we accept, as a set for lookup. */
const ALLOWED_CODES: ReadonlySet<string> = new Set(ALLOWED_PROGRAM_CODES);

function isAllowedCode(code: string | undefined): code is ProgramCode {
    return code !== undefined && ALLOWED_CODES.has(code);
}

/**
 * The TIHLDE study programmes Feide reports for the user. Campus is a separate
 * concern — see {@link partitionByCampus}.
 *
 * Reads two group types, because neither is enough alone:
 *
 * - `fc:fs:prg` — the programme, e.g. `fc:fs:fs:prg:ntnu.no:ITBAITBEDR`. This
 *   is the group that is reliably there, and it is the *only* one an upper-year
 *   student may have: a cohort membership is valid for a bounded period, so a
 *   third-year student's 2023 cohort has already lapsed. It carries no year.
 * - `fc:fs:kull` — the cohort, e.g. `fc:fs:fs:kull:ntnu.no:BIDATA:2023H`. This
 *   is where the start year comes from, and the cohort groups the priority
 *   pools inherited from Lepton are built on.
 *
 * Note the ids have different lengths, so the programme code is taken from the
 * *last* segment for `prg` and the second-to-last for `kull` — reading a fixed
 * index for both would yield `ntnu.no`.
 *
 * A malformed year is dropped rather than thrown: this used to abort the whole
 * login, which meant one bad group from Feide could lock a member out entirely.
 */
export function parseValidStudyPrograms(groups: FeideGroup[]): StudyProgram[] {
    const byCode = new Map<ProgramCode, StudyProgram>();

    for (const g of groups) {
        let code: string | undefined;
        let startYear: number | null = null;

        if (g.type === "fc:fs:prg") {
            code = g.id.split(":").at(-1);
        } else if (g.type === "fc:fs:kull") {
            const parts = g.id.split(":");
            code = parts.at(-2);

            const raw = parts.at(-1);
            const parsed = raw
                ? Number.parseInt(raw.substring(0, 4))
                : Number.NaN;

            if (!Number.isNaN(parsed) && parsed >= 2000 && parsed <= 3000) {
                startYear = parsed;
            } else if (raw) {
                console.warn(
                    `Ignoring Feide cohort with unexpected start year: ${g.id}`,
                );
            }
        } else {
            continue;
        }

        if (!isAllowedCode(code)) continue;

        /**
         * The same programme arrives as both a `prg` and a `kull` group, and
         * with `showAll=true` possibly several cohorts. Keep the concrete year
         * over an unknown one, and treat the member as active if *any* of the
         * groups for that programme still is — a lapsed cohort alongside an
         * active programme means enrolled, not finished.
         */
        const active = g.membership?.active === true;
        const existing = byCode.get(code);

        if (!existing) {
            byCode.set(code, { code, startYear, active });
            continue;
        }

        byCode.set(code, {
            code,
            startYear: existing.startYear ?? startYear,
            active: existing.active || active,
        });
    }

    return [...byCode.values()];
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
        .select({
            id: user.id,
            email: user.email,
            approvalStatus: user.approvalStatus,
        })
        .from(user)
        .where(eq(user.username, username))
        .limit(1);

    if (!match) {
        return null;
    }

    /**
     * An account someone made for themselves with a private address picked its
     * own username, and nothing stops that pick from being a real student's
     * NTNU username. Handing this login to it would not merely confuse the two
     * — it would drop the student into a stranger's account, with the
     * stranger's password still on it. Better Auth then falls back to matching
     * on the address Feide gave us, which is the correct behaviour for someone
     * who has never been here before.
     *
     * Migrated Lepton members carry no approval status, so this leaves the
     * case the function exists for untouched. A self-registered *student* is
     * matched as normal: the username came from their own stud address, so it
     * is theirs by the same proof Feide is about to supply.
     */
    if (
        match.approvalStatus !== null &&
        !match.email.trim().toLowerCase().endsWith("@stud.ntnu.no")
    ) {
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
 * Drop every credential and session an account collected before anyone proved
 * they control its address.
 *
 * Self-registration writes the `user` row before the verification mail is even
 * sent, and the address is only ever *claimed* — never proven. So an
 * `emailVerified: false` row carries no evidence that the password on it
 * belongs to the student the address names. Anyone can register
 * `<someone-elses-username>@stud.ntnu.no`, pick a password, and wait; NTNU
 * usernames are derived from names and are trivially guessable.
 *
 * The plant is inert while it sits there. `requireEmailVerification` blocks
 * password sign-in, and sign-up skips auto sign-in for the same reason, so the
 * row holds no session either. What arms it is the *victim's own* Feide login:
 * Better Auth links the provider, then flips `emailVerified` to true because
 * the addresses match — and from that moment the planted password works.
 *
 * Feide proves who the human is. It proves nothing about who typed a password
 * into that row last week, so the password does not survive the link. Better
 * Auth applies the identical rule to its own email-primary proofs — see
 * `revokeUnprovenAccountAccess`, used by magic link and email OTP. The OAuth
 * path never got it, which is why `requireLocalEmailVerified` guards that path
 * by refusing to link at all. Refusing is what stranded 15 new students in
 * August 2026: the guard cannot tell "I registered myself and forgot" from
 * "someone registered this for me", and the self-service way out mails a link
 * to an NTNU inbox first-year students cannot open yet.
 *
 * A *verified* account keeps its password untouched. Proving the mailbox is
 * exactly what makes that password theirs, and that proof already happened.
 *
 * Returns whether anything was revoked, so the caller can tell the member.
 */
export async function revokeUnprovenCredentials(
    db: NodePgDatabase<DbSchema>,
    userId: string,
): Promise<boolean> {
    const [owner] = await db
        .select({ emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

    if (!owner || owner.emailVerified) {
        return false;
    }

    const revoked = await db
        .delete(account)
        .where(
            and(
                eq(account.userId, userId),
                eq(account.providerId, CREDENTIAL_PROVIDER_ID),
            ),
        )
        .returning({ id: account.id });

    if (revoked.length === 0) {
        return false;
    }

    /**
     * Belt and braces: an unverified account cannot hold a session today,
     * because sign-up skips auto sign-in whenever verification is required.
     * That is one config flag away from changing, and a session left standing
     * would outlive the password just deleted.
     */
    await db.delete(session).where(eq(session.userId, userId));

    noteRevokedPassword(userId);

    console.warn(
        `Revoked ${revoked.length} unproven credential account(s) for user ${userId} on Feide link: the password predated any proof of the address.`,
    );

    return true;
}

/**
 * Users whose password was just revoked, so the callback can send them on to
 * set a new one.
 *
 * The revocation happens in a database hook, several layers below the response;
 * the redirect can only be rewritten in the `after` hook. Nothing in the
 * request context is shared between the two, hence this hand-off. Entries are
 * read once and expire on their own, so a login that never reaches the after
 * hook — a crash, a rewritten redirect — cannot strand a note that misdirects a
 * later login by the same member.
 */
const revokedPasswords = new Map<string, number>();

/** How long a hand-off stays valid. Generous; the two hooks are milliseconds apart. */
const REVOKED_PASSWORD_TTL_MS = 60_000;

function noteRevokedPassword(userId: string): void {
    const now = Date.now();
    for (const [id, at] of revokedPasswords) {
        if (now - at > REVOKED_PASSWORD_TTL_MS) revokedPasswords.delete(id);
    }
    revokedPasswords.set(userId, now);
}

function consumeRevokedPassword(userId: string): boolean {
    const at = revokedPasswords.get(userId);
    if (at === undefined) return false;

    revokedPasswords.delete(userId);
    return Date.now() - at <= REVOKED_PASSWORD_TTL_MS;
}

/**
 * Where to send a member whose password was taken away by the login they just
 * completed, or null to leave the redirect alone.
 *
 * `redirectTo` carries the destination they were originally headed for, so
 * setting a password — or skipping it — still lands them where they meant to
 * go. Exported for testing.
 */
export function passwordSetupRedirect(
    location: string,
    frontendUrl: string,
): string | null {
    let current: URL;
    let frontend: URL;
    try {
        current = new URL(location);
        frontend = new URL(frontendUrl);
    } catch {
        return null;
    }

    // A first-ever Feide login already goes here via `newUserCallbackURL`.
    if (current.pathname === "/velg-passord") {
        return null;
    }

    const target = new URL("/velg-passord", frontend);

    /**
     * Only a destination on our own site is worth carrying over: anything else
     * is either an error URL or something we should not be bouncing through.
     */
    target.searchParams.set(
        "redirectTo",
        current.origin === frontend.origin
            ? `${current.pathname}${current.search}`
            : "/",
    );

    /**
     * The page defaults to offering a password as a *bonus* — right for a
     * Feide account that never had one, and misleading for someone whose
     * password was just deleted. Telling it which it is, is the difference
     * between "hopp over" being a free choice and it quietly closing their
     * only non-Feide way in.
     */
    target.searchParams.set("passwordRevoked", "1");

    return target.toString();
}

/**
 * Rewrites the Feide callback's redirect for a member whose password was just
 * revoked, so they are told rather than left to find out.
 *
 * Better Auth sends first-time Feide *sign-ups* to `newUserCallbackURL` and
 * everyone else to the plain callback, with no signal in between for "linked,
 * and the old password is gone". Without this they land on the website looking
 * signed in, and discover the password is missing the day Feide is unreachable
 * — which is exactly the day the password form is the only way in.
 *
 * Mutating `responseHeaders` is what actually moves them: `c.redirect()` puts
 * `location` on the very Headers object the response is built from, so the
 * rewrite lands even though the endpoint has already thrown.
 */
export const redirectToPasswordSetupAfterRevoke: (
    middlewareCtx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
            returned?: unknown;
            responseHeaders?: Headers;
        }
    >,
    frontendUrl: string,
) => void = (middlewareContext, frontendUrl) => {
    if (
        !middlewareContext.path.startsWith("/oauth2/callback") ||
        middlewareContext.params.providerId !== FEIDE_PROVIDER_ID
    ) {
        return;
    }

    const session = middlewareContext.context.newSession;
    if (!session || !consumeRevokedPassword(session.user.id)) {
        return;
    }

    const headers = middlewareContext.context.responseHeaders;
    const location = headers?.get("location");
    if (!headers || !location) {
        return;
    }

    const next = passwordSetupRedirect(location, frontendUrl);
    if (next) {
        headers.set("location", next);
    }
};

/**
 * Read the OpenID profile Dataporten holds for an access token.
 *
 * Shared by the sign-in profile fetcher and the username backfill, which need
 * the exact same document: one to decide *which* account a login belongs to,
 * the other to fill in the username that decision depends on next time.
 */
async function fetchFeideProfile(accessToken: string): Promise<OpenIDProfile> {
    const response = await fetch("https://auth.dataporten.no/openid/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch user info");
    }

    return (await response.json()) as OpenIDProfile;
}

/**
 * Give a Feide-created account the NTNU username it never got, and return it.
 *
 * Better Auth builds a new OAuth user from name, email and image only, so a
 * member who signs up through Feide lands with `username` null — and username
 * sign-in is the *only* password route the login page offers, so that member
 * can never use a password even after setting one. The username is not ours to
 * invent: it is the local part of the Feide id, which Dataporten has already
 * authenticated.
 *
 * Runs from the sync on every Feide sign-in rather than at creation, so it
 * also repairs the accounts already created without one.
 *
 * Returns null rather than throwing on every failure it can meet — a missing
 * `userid_sec` claim, or a username already held by someone else. This is a
 * side errand of a sync whose real job is study data, and none of those cases
 * is worth costing the member their login. A taken username in particular is
 * the migrated-member collision {@link resolveMigratedEmail} guards: two
 * different people, one name, and picking wrong is worse than picking nothing.
 */
async function backfillUsername(
    db: AuthCreateContext["db"],
    userId: string,
    accessToken: string,
): Promise<string | null> {
    let username: string | null = null;
    try {
        username = feideUsernameOf(await fetchFeideProfile(accessToken));
    } catch (error) {
        console.warn(
            `Could not read the Feide profile to fill in a username for user ${userId}:`,
            error,
        );
        return null;
    }

    if (!username) {
        console.warn(
            `Feide userinfo carried no usable userid_sec claim, so user ${userId} keeps an empty username and cannot sign in with a password.`,
        );
        return null;
    }

    const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, username))
        .limit(1);

    if (taken) {
        if (taken.id !== userId) {
            console.warn(
                `Feide username ${username} already belongs to user ${taken.id}; leaving user ${userId} without one.`,
            );
        }
        return null;
    }

    await db
        .update(user)
        .set({ username, displayUsername: username })
        .where(and(eq(user.id, userId), isNull(user.username)));

    return username;
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

        const profile = await fetchFeideProfile(tokens.accessToken);

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
