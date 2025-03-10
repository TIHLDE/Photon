import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Creates a test container running postgres, and creates a prisma client
 * @returns Container instance as well as a corresponing PrismaClient
 */
export const setupDB = async () => {
    const c = await new PostgreSqlContainer().start();
    const url = `postgresql://${c.getUsername()}:${c.getPassword()}@${c.getHost()}:${c.getPort()}/${c.getDatabase()}?schema=public`;

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
    };
};
