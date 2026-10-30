import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

/**
 * Relations for the relational query builder (`db.query`), in Drizzle's v2
 * format. Every relation names both ends explicitly, so nothing depends on
 * Drizzle pairing up the two sides on its own.
 *
 * Each schema file defines the relations of its own tables as a
 * `defineRelationsPart`, at the bottom of the file because a part reads its
 * tables as soon as it is created. The auth tables are the exception: `auth.ts`
 * is generated and imports nothing, while `user` relates to tables that import
 * it.
 *
 * Order matters here. `defineRelations` lists every table and a spread replaces
 * a table's whole entry, so it has to come first, and a table can only have its
 * relations in one part.
 */
export const relations = {
    ...defineRelations(schema, (r) => ({
        user: {
            sessions: r.many.session({
                from: r.user.id,
                to: r.session.userId,
            }),
            accounts: r.many.account({
                from: r.user.id,
                to: r.account.userId,
            }),
            oauthClients: r.many.oauthClient({
                from: r.user.id,
                to: r.oauthClient.userId,
            }),
            oauthRefreshTokens: r.many.oauthRefreshToken({
                from: r.user.id,
                to: r.oauthRefreshToken.userId,
            }),
            oauthAccessTokens: r.many.oauthAccessToken({
                from: r.user.id,
                to: r.oauthAccessToken.userId,
            }),
            oauthConsents: r.many.oauthConsent({
                from: r.user.id,
                to: r.oauthConsent.userId,
            }),
            /**
             * Declared from this side, not from `userSettings`, so a user with no
             * settings row still answers: three accounts in production have none,
             * and `approvalStatus` — read alongside the settings on every
             * `get-session` — would silently read as "approved" for them if the
             * query started at the settings table.
             */
            settings: r.one.userSettings({
                from: r.user.id,
                to: r.userSettings.userId,
            }),
            studyProgramMemberships: r.many.studyProgramMembership({
                from: r.user.id,
                to: r.studyProgramMembership.userId,
            }),
        },
        session: {
            user: r.one.user({
                from: r.session.userId,
                to: r.user.id,
                optional: false,
            }),
            oauthRefreshTokens: r.many.oauthRefreshToken({
                from: r.session.id,
                to: r.oauthRefreshToken.sessionId,
            }),
            oauthAccessTokens: r.many.oauthAccessToken({
                from: r.session.id,
                to: r.oauthAccessToken.sessionId,
            }),
        },
        account: {
            user: r.one.user({
                from: r.account.userId,
                to: r.user.id,
                optional: false,
            }),
        },
        oauthClient: {
            user: r.one.user({
                from: r.oauthClient.userId,
                to: r.user.id,
            }),
            oauthRefreshTokens: r.many.oauthRefreshToken({
                from: r.oauthClient.clientId,
                to: r.oauthRefreshToken.clientId,
            }),
            oauthAccessTokens: r.many.oauthAccessToken({
                from: r.oauthClient.clientId,
                to: r.oauthAccessToken.clientId,
            }),
            oauthConsents: r.many.oauthConsent({
                from: r.oauthClient.clientId,
                to: r.oauthConsent.clientId,
            }),
        },
        oauthRefreshToken: {
            oauthClient: r.one.oauthClient({
                from: r.oauthRefreshToken.clientId,
                to: r.oauthClient.clientId,
                optional: false,
            }),
            session: r.one.session({
                from: r.oauthRefreshToken.sessionId,
                to: r.session.id,
            }),
            user: r.one.user({
                from: r.oauthRefreshToken.userId,
                to: r.user.id,
                optional: false,
            }),
            oauthAccessTokens: r.many.oauthAccessToken({
                from: r.oauthRefreshToken.id,
                to: r.oauthAccessToken.refreshId,
            }),
        },
        oauthAccessToken: {
            oauthClient: r.one.oauthClient({
                from: r.oauthAccessToken.clientId,
                to: r.oauthClient.clientId,
                optional: false,
            }),
            session: r.one.session({
                from: r.oauthAccessToken.sessionId,
                to: r.session.id,
            }),
            user: r.one.user({
                from: r.oauthAccessToken.userId,
                to: r.user.id,
            }),
            oauthRefreshToken: r.one.oauthRefreshToken({
                from: r.oauthAccessToken.refreshId,
                to: r.oauthRefreshToken.id,
            }),
        },
        oauthConsent: {
            oauthClient: r.one.oauthClient({
                from: r.oauthConsent.clientId,
                to: r.oauthClient.clientId,
                optional: false,
            }),
            user: r.one.user({
                from: r.oauthConsent.userId,
                to: r.user.id,
            }),
        },
    })),
    ...schema.apiKeyRelations,
    ...schema.applicationRelations,
    ...schema.assetRelations,
    ...schema.bannerRelations,
    ...schema.eventRelations,
    ...schema.feedbackRelations,
    ...schema.formRelations,
    ...schema.galleryRelations,
    ...schema.jobRelations,
    ...schema.newsRelations,
    ...schema.orgRelations,
    ...schema.userSettingsRelations,
};
