import { type AuthInstance, createAuth, drizzleAdapter } from "@photon/auth";
import {
    InMemoryQueueService,
    QueueManager,
    type QueueService,
} from "@photon/core/services/queue";
import { InMemoryObjectStorageService } from "@photon/core/services/storage";
import { env } from "@photon/core/env";
import { type DbSchema, createDb, schema } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type ApiKeyService, createApiKeyService } from "./service/api-key";
import {
    DatabaseAssetStorageService,
    type StorageService,
    createStorageClient,
} from "./storage";
import {
    ConsoleEmailService,
    QueuedEmailService,
    SMTPEmailService,
    type CacheService,
    type EmailService,
} from "@photon/core/services";
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
    queue: QueueService;
    /** Email service instance */
    email: EmailService;
    /** Direct email transport used by queue workers */
    emailDelivery: EmailService;
    /** Storage bucket (S3) service instance */
    bucket: StorageService;
}

export async function createAppContext(): Promise<AppContext> {
    const db = createDb({ connectionString: env.DATABASE_URL });
    const cache = await RedisCache.create(env.REDIS_URL);
    const queue = new QueueManager(env.REDIS_URL);
    const email = new QueuedEmailService(queue);
    const emailDelivery = createEmailDeliveryService();
    const bucket = await createStorageClient({ db });

    const auth = createAuth({
        isDevMode: env.NODE_ENV === "development" || env.NODE_ENV === "test",
        services: {
            database: drizzleAdapter(db, { provider: "pg", schema }),
            cache,
            email,
        },
        oauth: {
            pages: {
                consent: "/consent",
                login: "/login",
            },
        },
        urls: {
            backend: env.ROOT_URL,
            frontend: env.WEBSITE_URL,
            additionalTrusted: [env.ROOT_URL, env.WEBSITE_URL],
            basePath: "/api/auth",
        },
        DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: false,
    });
    return {
        db,
        auth,
        cache,
        queue,
        email,
        emailDelivery,
        bucket,
    };
}

export const createMainAppContext = createAppContext;

export async function createTestAppContext(options?: {
    db?: NodePgDatabase<DbSchema>;
}): Promise<AppContext> {
    const db = options?.db ?? createDb({ connectionString: env.DATABASE_URL });
    const cache = new InMemoryCache();
    const queue = new InMemoryQueueService();
    const email = new ConsoleEmailService();
    const bucket = new DatabaseAssetStorageService(
        new InMemoryObjectStorageService(),
        db,
    );
    const auth = createAuth({
        isDevMode: env.NODE_ENV === "development" || env.NODE_ENV === "test",
        services: {
            database: drizzleAdapter(db, { provider: "pg", schema }),
            cache,
            email,
        },
        oauth: {
            pages: {
                consent: "/consent",
                login: "/login",
            },
        },
        urls: {
            backend: env.ROOT_URL,
            frontend: env.WEBSITE_URL,
            additionalTrusted: [env.ROOT_URL, env.WEBSITE_URL],
            basePath: "/api/auth",
        },
        DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: true,
    });

    return {
        db,
        auth,
        cache,
        queue,
        email,
        emailDelivery: email,
        bucket,
    };
}

export interface AppServices {
    apiKey: ApiKeyService;
}

function createEmailDeliveryService(): EmailService {
    if (!env.MAIL_HOST) {
        return new ConsoleEmailService();
    }

    return new SMTPEmailService({
        host: env.MAIL_HOST,
        port: env.MAIL_PORT,
        secure: env.MAIL_PORT === 465,
        auth:
            env.MAIL_USER && env.MAIL_PASS
                ? {
                      user: env.MAIL_USER,
                      pass: env.MAIL_PASS,
                  }
                : undefined,
    } as ConstructorParameters<typeof SMTPEmailService>[0]);
}

export function createAppServices(ctx: AppContext): AppServices {
    return {
        apiKey: createApiKeyService(ctx),
    };
}
