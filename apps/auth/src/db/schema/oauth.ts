import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createTable } from ".";

export const oauthClients = createTable("oauth_client", {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id").notNull().unique(),
    clientSecret: text("client_secret").notNull(),
    redirectUris: text("redirect_uris").array().notNull(),
    scopes: text("scopes").array().notNull(),
    name: text("name").notNull(),
})

export const oauthCodes = createTable("oauth_code", {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    clientId: uuid("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})