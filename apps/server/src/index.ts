import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { env } from "node:process";

declare module "hono" {
    interface Context {
        db: PrismaClient;
    }
}

interface CreateAppArg {
    db?: PrismaClient;
}

const createApp = ({ db }: CreateAppArg) => {
    const app = new Hono();

    // Inject database client
    app.use("*", async (c, next) => {
        if (db) {
            c.db = db;
        } else {
            c.db = new PrismaClient();
        }

        await next();
    });

    app.get("/", (c) => {
        return c.text("Hello world!");
    });

    app.get("/book", async (c) => {
        const books = await c.db.book.findMany();
        return c.json(books);
    });

    return app;
};

export default createApp;

const app = createApp({});

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port,
});
