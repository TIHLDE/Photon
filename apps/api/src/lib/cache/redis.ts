import { createClient } from "redis";
import { env } from "~/lib/env";

type Client = ReturnType<typeof createClient>;

let client: Client | null = null;
let connectPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
    if (client) return client;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const c = createClient({ url: env.REDIS_URL });
        c.on("error", (err) => {
            // Surface connection issues early
            console.error("Redis client error:", err);
        });
        await c.connect();
        await c.ping();
        client = c;
        return c;
    })();

    return connectPromise;
}

export async function getRedis(): Promise<Client> {
    return connect();
}

export type RedisClientType = Client;
