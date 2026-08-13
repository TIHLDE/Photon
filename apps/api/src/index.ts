import { env } from "@photon/core/env";
import { setupWebhooks } from "./lib/vipps";

export { createApp } from "./app";
export type { App } from "./app";

/**
 * Keep a single stray rejection from taking down the API.
 *
 * On 2026-08-13 a `rollback` failed against a connection that had just been
 * killed, the rejection reached the top level, and Bun exited — turning an
 * outage that affected database-backed routes into one where even the health
 * check was gone, with nothing to restart the container. A server that has
 * hundreds of in-flight requests is better off logging the fault and staying
 * up: the failing request still fails, everyone else keeps being served.
 *
 * These are a safety net, not a place to handle errors. Anything logged here
 * is a bug in the code that produced the floating promise.
 */
function installCrashGuards(): void {
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled promise rejection — server stays up:", reason);
    });

    process.on("uncaughtException", (error) => {
        console.error("Uncaught exception — server stays up:", error);
    });
}

if (env.NODE_ENV !== "test") {
    installCrashGuards();

    void (await setupWebhooks());

    const { createApp } = await import("./app");
    const app = await createApp();
    const { serveStatic } = await import("hono/bun");
    app.get("/static/*", serveStatic({ root: "./" }));

    Bun.serve({
        fetch: app.fetch,
        port: env.PORT,
    });

    console.log(`📦 Server is running on http://localhost:${env.PORT}/api`);
    console.log(
        `📋 Documentation is running on http://localhost:${env.PORT}/docs`,
    );
}
