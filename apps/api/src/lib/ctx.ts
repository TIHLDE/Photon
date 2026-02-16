import { type AuthInstance, createAuth } from "@photon/auth/server";
import { type DbSchema, createDb } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";
import { QueueManager } from "./cache/queue";
import { type RedisClient, createRedisClient } from "./cache/redis";
import {
    type EmailTransporter,
    createEmailTransporter,
    enqueueEmail,
} from "./email";
import ChangeEmailVerificationEmail from "./email/template/change-email-verification";
import OtpSignInEmail from "./email/template/otp-sign-in";
import ResetPasswordEmail from "./email/template/reset-password";
import { env } from "./env";
import { type ApiKeyService, createApiKeyService } from "./service/api-key";
import { type StorageClient, createStorageClient } from "./storage";

/**
 * Application context containing all external service dependencies.
 * This allows for dependency injection and makes testing easier.
 */
export interface AppContext {
    /** Database client instance */
    db: NodePgDatabase<DbSchema>;
    /** Redis client instance */
    redis: RedisClient;
    /** Queue manager for creating/accessing Bull queues */
    queue: QueueManager;
    /** BetterAuth instance */
    auth: AuthInstance;
    /** Email transporter instance */
    mailer: EmailTransporter;
    /** Storage bucket client instance (null if storage is unavailable) */
    bucket: StorageClient | null;
}

/**
 * Create the application context with real service instances.
 * This is used in production.
 */
export async function createAppContext(): Promise<AppContext> {
    const db = createDb({ connectionString: env.DATABASE_URL });
    const redis = await createRedisClient(env.REDIS_URL);
    const queue = new QueueManager(env.REDIS_URL);
    const mailer = createEmailTransporter();
    let bucket: StorageClient | null = null;
    bucket = await createStorageClient({ db });

    const auth = createAuth({
        db,
        redis,
        baseURL: env.ROOT_URL,
        feide: {
            clientId: env.FEIDE_CLIENT_ID,
            clientSecret: env.FEIDE_CLIENT_SECRET,
        },
        isProduction: env.NODE_ENV === "production",
        trustedOrigins: [
            "https://tihlde.org",
            "https://*.tihlde.org",
            "localhost:3000",
            "http://localhost:3000",
        ],
        sendEmail: {
            resetPassword: async ({ url, email }) => {
                await enqueueEmail(
                    {
                        component: ResetPasswordEmail({ url }),
                        subject: "Tilbakestill ditt passord",
                        to: email,
                    },
                    { queue },
                );
            },
            changeEmailVerification: async ({ url, newEmail }) => {
                await enqueueEmail(
                    {
                        component: ChangeEmailVerificationEmail({ url }),
                        subject: "Verifiser din nye e-postadresse",
                        to: newEmail,
                    },
                    { queue },
                );
            },
            otp: async ({ email, otp }) => {
                await enqueueEmail(
                    {
                        component: OtpSignInEmail({ otp }),
                        subject: "Din engangskode",
                        to: email,
                    },
                    { queue },
                );
            },
        },
    });

    return {
        db,
        redis,
        queue,
        auth,
        mailer,
        bucket,
    };
}

/**
 * Get the storage bucket from context, or throw HTTP 500 if unavailable.
 * Use this in routes that require file storage.
 */
export function requireBucket(ctx: AppContext): StorageClient {
    if (!ctx.bucket) {
        throw new HTTPException(500, {
            message: "File storage is not available",
        });
    }
    return ctx.bucket;
}

export interface AppServices {
    apiKey: ApiKeyService;
}

export function createAppServices(ctx: AppContext): AppServices {
    return {
        apiKey: createApiKeyService(ctx),
    };
}
