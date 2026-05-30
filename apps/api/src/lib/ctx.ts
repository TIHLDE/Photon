import { type AuthInstance, createAuth, drizzleAdapter } from "@photon/auth";
import { QueueManager } from "@photon/core/services/queue";
import { env } from "@photon/core/env";
import { type DbSchema, createDb } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type ApiKeyService, createApiKeyService } from "./service/api-key";
import { type StorageClient, createStorageClient } from "./storage";
import { CacheService, EmailService } from "@photon/core/services";
import { RedisCache, InMemoryCache } from "@photon/core/services/cache";

/**
 * Application context containing all external service dependencies.
 * This allows for dependency injection and makes testing easier.
 */
export interface AppContext {
    db: NodePgDatabase<DbSchema>;
    auth: AuthInstance;

    /** Cache service instance */
    cache: CacheService;
    /** Queue service instance */
    queue: QueueManager; // TODO: Rename to QueueService
    /** Email service instance */
    email: EmailService;
    /** Storage bucket (S3) service instance */
    bucket: StorageClient;
}

export async function createMainAppContext(): Promise<AppContext> {
    const db = createDb({ connectionString: env.DATABASE_URL });
    const cache = await RedisCache.create(env.REDIS_URL);
    const queue = new QueueManager();
    const email = new EmailService();
    const bucket = await createStorageClient({ db });

    const auth = createAuth({
        isDevMode: env.NODE_ENV === "development" || env.NODE_ENV === "test",
        services: {
            database: drizzleAdapter(db, { provider: "pg" }),
            cache: await RedisCache.create(env.REDIS_URL),
            email: {} as EmailService,
        },
        oauth: {
            pages: {
                consent: "/consent",
                login: "/login",
            },
        },
        urls: {
            // TODO: Do some conditional logic here based on if we're in dev or prod
            backend: "https://photon.tihlde.org",
            frontend: "https://tihlde.org",
            additionalTrusted: [
                "https://photon.tihlde.org",
                "https://tihlde.org",
            ],
            basePath: "/api/auth",
        },
        secret: env.AUTH_SECRET,
    });
    return {
        db,
        auth,
        cache,
        queue,
        email,
        bucket,
    };
}

export async function createTestAppContext(): Promise<AppContext> {
    // TODO: Replace with test database PGLite
    const db = createDb({ connectionString: env.DATABASE_URL });
    const auth = createAuth({
        isDevMode: env.NODE_ENV === "development" || env.NODE_ENV === "test",
        services: {
            database: drizzleAdapter(db, { provider: "pg" }),
            cache: new InMemoryCache(),
            email: new EmailService(),
        },
    });
}

export interface AppServices {
    apiKey: ApiKeyService;
}

export function createAppServices(ctx: AppContext): AppServices {
    return {
        apiKey: createApiKeyService(ctx),
    };
}
