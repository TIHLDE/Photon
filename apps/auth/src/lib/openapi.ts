import { apiReference } from "@scalar/hono-api-reference";
import type { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";

export function configureOpenAPI(app: Hono) {
    app.get("/openapi", openAPISpecs(app, {
        documentation: {
            info: {
                title: "Auth API",
                version: "1.0.0",
                description: "API for TIHLDE Auth"
            }
        }
    }))

    app.get("/docs", apiReference({
        layout: "modern",
        spec: {
            url: "/openapi",
        }
    }))
}