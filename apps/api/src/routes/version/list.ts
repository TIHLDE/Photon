import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { versionResponseSchema } from "./schema";

/**
 * Captured when the module is first loaded, which is process boot — not the
 * first request. Reading the clock inside the handler would make every
 * response say "now", and the route would never reveal the thing it exists
 * for: a container that was never swapped.
 */
const startedAt = new Date();

/**
 * Baked in by the image build; see `infra/docker/Dockerfile`. A container that
 * did not come from the release pipeline — a local `docker build`, or a run
 * straight from source — has neither, and says so rather than reporting a
 * version it invented.
 */
const version = process.env.APP_VERSION || "unknown";
const commit = process.env.GIT_SHA || "unknown";

export const versionRoute = route().get(
    "/",
    describeRoute({
        tags: ["meta"],
        summary: "Build and uptime of the running instance",
        operationId: "getVersion",
        description:
            "What is actually running right now. A deploy is only finished once the host has swapped the container, which is minutes after the workflow reports success — and the workflow reporting success is not evidence that it happened. Before this route, the only way to tell from outside was to find a schema that happened to change in that release; 2026-08-22.release-1 changed none, so its deploy could not be confirmed at all. Public, and carries nothing but build metadata.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: versionResponseSchema,
            description: "OK",
        })
        .build(),
    (c) => {
        return c.json(
            {
                version,
                commit,
                startedAt: startedAt.toISOString(),
                uptimeSeconds: Math.floor(
                    (Date.now() - startedAt.getTime()) / 1000,
                ),
            },
            200,
        );
    },
);
