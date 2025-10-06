import type {
    AuthContext,
    MiddlewareContext,
    MiddlewareOptions,
    OAuth2Tokens,
    OAuth2UserInfo,
    User,
} from "better-auth";
import { genericOAuth, oAuthDiscoveryMetadata } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import db from "../../db";
import { account, studyProgram, studyProgramMembership } from "../../db/schema";
import { env } from "../env";

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
 * Authentication plugin for Feide using OpenID Connect
 */
export const feidePlugin = () =>
    genericOAuth({
        config: [
            {
                providerId: FEIDE_PROVIDER_ID,
                clientId: env.FEIDE_CLIENT_ID,
                clientSecret: env.FEIDE_CLIENT_SECRET,
                discoveryUrl:
                    "https://auth.dataporten.no/.well-known/openid-configuration",
                scopes: ["openid", "userid", "profile", "groups-edu", "email"],
                getUserInfo,
            },
        ],
    });

/**
 * Runs Feide tasks AFTER each auth request, to ensure synced info
 *
 * Important to note that this should run in the BetterAuth "after" hook
 * @param ctx Middleware context
 */
export const syncFeideHook: (
    ctx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
            returned?: unknown;
            responseHeaders?: Headers;
        }
    >,
) => Promise<void> = async (ctx) => {
    if (
        ctx.path.startsWith("/oauth2/callback") &&
        ctx.params.providerId === FEIDE_PROVIDER_ID
    ) {
        const session = ctx.context.newSession;
        if (!session) {
            throw new Error("No session found after Feide callback executed");
        }

        const userId = session.user.id;

        const feideAccount = await db
            .select({ accessToken: account.accessToken })
            .from(account)
            .where(eq(account.userId, userId))
            .limit(1);

        const token = feideAccount[0]?.accessToken;

        if (!token) {
            throw new Error("No Feide account linked to user");
        }

        const groups = await fetchValidStudyPrograms(token);

        // Add user to all valid study programs
        await db.transaction(async (tx) => {
            for (const feideGroup of groups) {
                const sp = await tx
                    .select({ id: studyProgram.id })
                    .from(studyProgram)
                    .where(eq(studyProgram.feideCode, feideGroup.code))
                    .limit(1);

                if (!sp[0]) {
                    console.warn(
                        `User is part of unknown study program ${feideGroup}, skipping`,
                    );
                    continue;
                }

                const studyProgramId = sp[0].id;

                await tx.insert(studyProgramMembership).values({
                    userId,
                    studyProgramId,
                    startYear: feideGroup.startYear,
                });
            }
        });
    }
};

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
