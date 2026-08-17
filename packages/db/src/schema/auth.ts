import { relations } from "drizzle-orm";
import {
    text,
    timestamp,
    boolean,
    jsonb,
    index,
    pgTableCreator,
} from "drizzle-orm/pg-core";

import { userSettings } from "./user";

const pgTable = pgTableCreator((name) => `auth_${name}`);

/**
 * Where an account stands with a human approver.
 *
 * - `null`: nobody has to approve it. Feide logins, the Lepton migration, the
 *   Fadderuka route and seeds all land here — the account's right to exist is
 *   already established by the system that made it.
 * - `pending`: someone signed themselves up on the website. They can log in and
 *   see what any visitor sees, and nothing more, until an admin approves them.
 * - `approved`: an admin (or a later Feide login) confirmed them, and the
 *   `member` role was granted.
 *
 * Kept as a column rather than "has no roles yet", because roles come and go
 * for other reasons and only this says *why* someone has none.
 */
export const APPROVAL_STATUSES = ["pending", "approved"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/**
 * Origin of a stored password. Only `migrated` is ever written — a NULL means
 * the member chose the password themselves. See `account.passwordSource`.
 */
export const PASSWORD_SOURCES = ["migrated"] as const;
export type PasswordSource = (typeof PASSWORD_SOURCES)[number];

export const user = pgTable(
    "user",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        emailVerified: boolean("email_verified").default(false).notNull(),
        image: text("image"),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
        role: text("role"),
        banned: boolean("banned").default(false),
        banReason: text("ban_reason"),
        banExpires: timestamp("ban_expires"),
        username: text("username").unique(),
        displayUsername: text("display_username"),
        approvalStatus: text("approval_status").$type<ApprovalStatus>(),
        approvedAt: timestamp("approved_at"),
        approvedBy: text("approved_by"),
    },
    (table) => [index("user_approvalStatus_idx").on(table.approvalStatus)],
);

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        impersonatedBy: text("impersonated_by"),
    },
    (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        /**
         * Where `password` came from — only ever set on `credential` rows.
         *
         * `migrated` marks the 1634 accounts the Lepton migration created with
         * a `crypto.randomUUID()` password it never stored anywhere
         * (`packages/lepton-migration/import-users.ts`). Those rows grant
         * nobody access: the member cannot know the value, so "this account
         * has a password" is true in the schema and false in practice.
         *
         * Without this the two states are indistinguishable, and the prompt to
         * choose a TIHLDE password would skip exactly the people who need it —
         * 215 of them also have Feide and would otherwise never be asked.
         *
         * NULL means the password was chosen by the member. Deliberately not
         * `notNull` with a default: a backfilled marker is a statement about
         * the past, and every row written from here on is a real password.
         */
        passwordSource: text("password_source").$type<PasswordSource>(),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const jwks = pgTable("jwks", {
    id: text("id").primaryKey(),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    createdAt: timestamp("created_at").notNull(),
    expiresAt: timestamp("expires_at"),
});

export const oauthClient = pgTable(
    "oauth_client",
    {
        id: text("id").primaryKey(),
        clientId: text("client_id").notNull().unique(),
        clientSecret: text("client_secret"),
        disabled: boolean("disabled").default(false),
        skipConsent: boolean("skip_consent"),
        enableEndSession: boolean("enable_end_session"),
        subjectType: text("subject_type"),
        scopes: text("scopes").array(),
        userId: text("user_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        createdAt: timestamp("created_at"),
        updatedAt: timestamp("updated_at"),
        name: text("name"),
        uri: text("uri"),
        icon: text("icon"),
        contacts: text("contacts").array(),
        tos: text("tos"),
        policy: text("policy"),
        softwareId: text("software_id"),
        softwareVersion: text("software_version"),
        softwareStatement: text("software_statement"),
        redirectUris: text("redirect_uris").array().notNull(),
        postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
        tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
        grantTypes: text("grant_types").array(),
        responseTypes: text("response_types").array(),
        public: boolean("public"),
        type: text("type"),
        requirePKCE: boolean("require_pkce"),
        referenceId: text("reference_id"),
        metadata: jsonb("metadata"),
    },
    (table) => [index("oauthClient_userId_idx").on(table.userId)],
);

export const oauthRefreshToken = pgTable(
    "oauth_refresh_token",
    {
        id: text("id").primaryKey(),
        token: text("token").notNull().unique(),
        clientId: text("client_id")
            .notNull()
            .references(() => oauthClient.clientId, { onDelete: "cascade" }),
        sessionId: text("session_id").references(() => session.id, {
            onDelete: "set null",
        }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        referenceId: text("reference_id"),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull(),
        revoked: timestamp("revoked"),
        authTime: timestamp("auth_time"),
        scopes: text("scopes").array().notNull(),
    },
    (table) => [
        index("oauthRefreshToken_clientId_idx").on(table.clientId),
        index("oauthRefreshToken_sessionId_idx").on(table.sessionId),
        index("oauthRefreshToken_userId_idx").on(table.userId),
    ],
);

export const oauthAccessToken = pgTable(
    "oauth_access_token",
    {
        id: text("id").primaryKey(),
        token: text("token").notNull().unique(),
        clientId: text("client_id")
            .notNull()
            .references(() => oauthClient.clientId, { onDelete: "cascade" }),
        sessionId: text("session_id").references(() => session.id, {
            onDelete: "set null",
        }),
        userId: text("user_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        referenceId: text("reference_id"),
        refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
            onDelete: "cascade",
        }),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull(),
        scopes: text("scopes").array().notNull(),
    },
    (table) => [
        index("oauthAccessToken_clientId_idx").on(table.clientId),
        index("oauthAccessToken_sessionId_idx").on(table.sessionId),
        index("oauthAccessToken_userId_idx").on(table.userId),
        index("oauthAccessToken_refreshId_idx").on(table.refreshId),
    ],
);

export const oauthConsent = pgTable(
    "oauth_consent",
    {
        id: text("id").primaryKey(),
        clientId: text("client_id")
            .notNull()
            .references(() => oauthClient.clientId, { onDelete: "cascade" }),
        userId: text("user_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        referenceId: text("reference_id"),
        scopes: text("scopes").array().notNull(),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at").notNull(),
    },
    (table) => [
        index("oauthConsent_clientId_idx").on(table.clientId),
        index("oauthConsent_userId_idx").on(table.userId),
    ],
);

export const userRelations = relations(user, ({ one, many }) => ({
    sessions: many(session),
    accounts: many(account),
    oauthClients: many(oauthClient),
    oauthRefreshTokens: many(oauthRefreshToken),
    oauthAccessTokens: many(oauthAccessToken),
    oauthConsents: many(oauthConsent),
    /**
     * Declared from this side, not from `userSettings`, so a user with no
     * settings row still answers: three accounts in production have none, and
     * `approvalStatus` — read alongside the settings on every `get-session` —
     * would silently read as "approved" for them if the query started at the
     * settings table.
     *
     * `userSettings` is imported lazily through the relations callback, which
     * is what keeps this from being a module cycle: `user.ts` imports `user`
     * from here at load, and this only touches `userSettings` when the
     * relational schema is built.
     */
    settings: one(userSettings, {
        fields: [user.id],
        references: [userSettings.userId],
    }),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
    oauthRefreshTokens: many(oauthRefreshToken),
    oauthAccessTokens: many(oauthAccessToken),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
    user: one(user, {
        fields: [oauthClient.userId],
        references: [user.id],
    }),
    oauthRefreshTokens: many(oauthRefreshToken),
    oauthAccessTokens: many(oauthAccessToken),
    oauthConsents: many(oauthConsent),
}));

export const oauthRefreshTokenRelations = relations(
    oauthRefreshToken,
    ({ one, many }) => ({
        oauthClient: one(oauthClient, {
            fields: [oauthRefreshToken.clientId],
            references: [oauthClient.clientId],
        }),
        session: one(session, {
            fields: [oauthRefreshToken.sessionId],
            references: [session.id],
        }),
        user: one(user, {
            fields: [oauthRefreshToken.userId],
            references: [user.id],
        }),
        oauthAccessTokens: many(oauthAccessToken),
    }),
);

export const oauthAccessTokenRelations = relations(
    oauthAccessToken,
    ({ one }) => ({
        oauthClient: one(oauthClient, {
            fields: [oauthAccessToken.clientId],
            references: [oauthClient.clientId],
        }),
        session: one(session, {
            fields: [oauthAccessToken.sessionId],
            references: [session.id],
        }),
        user: one(user, {
            fields: [oauthAccessToken.userId],
            references: [user.id],
        }),
        oauthRefreshToken: one(oauthRefreshToken, {
            fields: [oauthAccessToken.refreshId],
            references: [oauthRefreshToken.id],
        }),
    }),
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
    oauthClient: one(oauthClient, {
        fields: [oauthConsent.clientId],
        references: [oauthClient.clientId],
    }),
    user: one(user, {
        fields: [oauthConsent.userId],
        references: [user.id],
    }),
}));
