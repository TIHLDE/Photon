import { PrismaClient } from "@prisma/client";
import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { test } from "vitest";

/**
 * Creates a test container running postgres, and creates a prisma client
 * @returns Container instance as well as a corresponing PrismaClient
 */
export const setupDB = async () => {
    const c = await new PostgreSqlContainer().start();
    const url = `postgresql://${c.getUsername()}:${c.getPassword()}@${c.getHost()}:${c.getPort()}/${c.getDatabase()}?schema=public`;

    execSync(`DATABASE_URL=${url} pnpm prisma db push --accept-data-loss`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url,
            },
        },
    });

    return {
        container: c,
        prisma,
        url,
    };
};

export const resetDB = async (prisma: PrismaClient) => {
    await prisma.book.deleteMany();
};

export const teardownDB = async (c: StartedPostgreSqlContainer) => {
    await c.stop();
};

/**
 * Creates a test context that provides a fresh prisma client for each test invocation
 * 
 * ## Usage:
 * ```
 * testWithDB("Books", async ({ db }) => {
    await db.book.create({
        data: {
            author: "Halla",
            title: "The Great Book",
        },
    });

    const app = createApp({db});

    app.request("/my-endpoint", ...);
 * ```
 */
export const testWithDB = test.extend<{
    db: PrismaClient;
}>({
    // biome-ignore lint/correctness/noEmptyPattern: This is a valid pattern
    db: async ({}, use) => {
        const ctx = await setupDB();
        await use(ctx.prisma);
        await teardownDB(ctx.container);
    },
});
