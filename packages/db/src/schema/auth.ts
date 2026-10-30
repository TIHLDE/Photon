import {
    text,
    timestamp,
    boolean,
    jsonb,
    index,
    pgTableCreator,
} from "drizzle-orm/pg-core";

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
        email: text("email").notNull().unique("auth_user_email_unique"),
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
        username: text("username").unique("auth_user_username_unique"),
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
        token: text("token").notNull().unique("auth_session_token_unique"),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, {
                name: "auth_session_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
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
            .references(() => user.id, {
                name: "auth_account_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => new Date())
            .notNull(),
        /**
         * Where `password` came from — only ever set on `credential` rows.
         *
         * `migrated` marks the 1634 accounts the Lepton migration created with
         * a `crypto.randomUUID()` password it never stored anywhere. Those rows
         * grant nobody access: the member cannot know the value, so "this account
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
        clientId: text("client_id")
            .notNull()
            .unique("auth_oauth_client_client_id_unique"),
        clientSecret: text("client_secret"),
        disabled: boolean("disabled").default(false),
        skipConsent: boolean("skip_consent"),
        enableEndSession: boolean("enable_end_session"),
        subjectType: text("subject_type"),
        scopes: text("scopes").array(),
        userId: text("user_id").references(() => user.id, {
            name: "auth_oauth_client_user_id_auth_user_id_fk",
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
        token: text("token")
            .notNull()
            .unique("auth_oauth_refresh_token_token_unique"),
        clientId: text("client_id")
            .notNull()
            .references(() => oauthClient.clientId, {
                name: "auth_oauth_refresh_token_client_id_auth_oauth_client_client_id_",
                onDelete: "cascade",
            }),
        sessionId: text("session_id").references(() => session.id, {
            name: "auth_oauth_refresh_token_session_id_auth_session_id_fk",
            onDelete: "set null",
        }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, {
                name: "auth_oauth_refresh_token_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
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
        token: text("token")
            .notNull()
            .unique("auth_oauth_access_token_token_unique"),
        clientId: text("client_id")
            .notNull()
            .references(() => oauthClient.clientId, {
                name: "auth_oauth_access_token_client_id_auth_oauth_client_client_id_f",
                onDelete: "cascade",
            }),
        sessionId: text("session_id").references(() => session.id, {
            name: "auth_oauth_access_token_session_id_auth_session_id_fk",
            onDelete: "set null",
        }),
        userId: text("user_id").references(() => user.id, {
            name: "auth_oauth_access_token_user_id_auth_user_id_fk",
            onDelete: "cascade",
        }),
        referenceId: text("reference_id"),
        refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
            name: "auth_oauth_access_token_refresh_id_auth_oauth_refresh_token_id_",
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
            .references(() => oauthClient.clientId, {
                name: "auth_oauth_consent_client_id_auth_oauth_client_client_id_fk",
                onDelete: "cascade",
            }),
        userId: text("user_id").references(() => user.id, {
            name: "auth_oauth_consent_user_id_auth_user_id_fk",
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
