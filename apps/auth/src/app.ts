import { logger } from "hono/logger";
import { Hono } from "hono";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { configureOpenAPI } from "@/lib/openapi";
import { env } from "@/env";
import { describeRoute } from "hono-openapi";
import { StatusCodes, textContent } from "@/lib/http";

const app = new Hono()

app.use(logger())

configureOpenAPI(app)

app.get("/ping", describeRoute({
    description: "Ping the server",
    responses: {
        [StatusCodes.OK]: textContent("pong")
    },
}), (c) => c.text("pong"))

async function getRoutes(dir: string, basePath = "") {
    const entries = readdirSync(dir);
    const routes: { path: string, router: Hono }[] = [];

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            const subRoutes = await getRoutes(fullPath, `${basePath}/${entry}`);
            routes.push(...subRoutes);
        } else if (entry === "index.ts") {
            const routePath = basePath || "/";
            const module = await import(resolve(fullPath));
            routes.push({ path: routePath, router: module.default });
        }
    }

    return routes;
}

if (env.NODE_ENV === "development") {
    console.log("Route paths:", (await getRoutes(resolve(import.meta.dirname, "routes"))).map(({ path }) => path));
}

const routes = await getRoutes(resolve(import.meta.dirname, "routes"));
for (const { path, router } of routes) {
    app.route(path, router);
}

export default app;