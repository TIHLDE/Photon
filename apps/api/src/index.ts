import { env } from "@photon/core/env";
import { setupWebhooks } from "./lib/vipps";
import { installErrorInterceptors } from "./lib/logger";

export { createApp } from "./app";
export type { App } from "./app";

if (env.NODE_ENV !== "test") {
    installErrorInterceptors();

    void (await setupWebhooks());

    const { createApp } = await import("./app");
    const app = await createApp();
    const { serveStatic } = await import("hono/bun");
    app.get("/static/*", serveStatic({ root: "./" }));

    Bun.serve({
        fetch: app.fetch,
        port: env.PORT,
    });

    if (env.NODE_ENV === "development") {
        console.log(`📦 Server is running on http://localhost:${env.PORT}/api`);
        console.log(
            `📋 Documentation is running on http://localhost:${env.PORT}/docs`,
        );
    }
}
