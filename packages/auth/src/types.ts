import type { DbSchema } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Minimal dependencies required by the auth package.
 * The consuming app passes its full context; the auth package only uses what it needs.
 */
export type AuthDeps = {
    /** Database client instance */
    db: NodePgDatabase<DbSchema>;
    /** Redis-compatible secondary storage */
    redis: {
        get(key: string): Promise<string | null>;
        set(
            key: string,
            value: string,
            options?: { EX?: number },
        ): Promise<unknown>;
        del(key: string | string[]): Promise<unknown>;
    };
    /** Optional email sending callbacks */
    sendEmail?: {
        resetPassword?: (args: {
            url: string;
            email: string;
        }) => Promise<void>;
        changeEmailVerification?: (args: {
            url: string;
            newEmail: string;
        }) => Promise<void>;
        otp?: (args: {
            email: string;
            otp: string;
            type: string;
        }) => Promise<void>;
    };
    /** Base URL of the application */
    baseURL: string;
    /** Feide OAuth credentials */
    feide: {
        clientId: string;
        clientSecret: string;
    };
    /** Whether the app is running in production mode */
    isProduction: boolean;
    /** Trusted origins for CORS/cookies */
    trustedOrigins: string[];
};
