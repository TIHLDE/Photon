import { validator } from "hono-openapi";
import { createMiddleware } from "hono/factory";
import z from "zod";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

const DEFAULT_OFFSET = 0;

type Variables = {
    limit: number;
    offset: number;
};

/**
 * Middleware factory for handling pagination in API requests.
 *
 * Applies validation to the `limit` and `offset` query parameters, ensuring:
 * - `limit` is an optional number between 1 and 100 (default: 10).
 * - `offset` is an optional number greater than or equal to 0 (default: 0).
 *
 * The middleware sets the validated (and optionally overridden) `limit` and `offset`
 * values on the context for downstream handlers. It also handles defining properties
 * for the OpenAPI schema.
 *
 * ### Usage
 *
 * Use the spread operator to include both the OpenAPI validator and extraction middleware.
 *
 * ```ts
 * route.get(
 *   "/",
 *   // ...middlware
 *   ...withPagination({ limit: 20 }) // i.e. override default limit to 20
 *   async (c) => {
 *     const limit = c.get("limit"); // 20
 *     const offset = c.get("offset"); // 0
 *   }
 * )
 * ```
 *
 * @param override - Optional object to override the parsed `limit` and `offset` values.
 * @returns An array of middleware functions for pagination validation and assignment.
 */
export const withPagination = (override?: Partial<Variables>) =>
    [
        validator(
            "query",
            z.object({
                limit: z.coerce.number().min(1).max(100).optional(),
                offset: z.coerce.number().min(0).optional(),
            }),
        ),
        createMiddleware<{ Variables: Variables }>(async (c, next) => {
            const limit = Math.min(
                Math.max(
                    Number.parseInt(
                        c.req.query("limit") || DEFAULT_LIMIT.toString(),
                        DEFAULT_LIMIT,
                    ),
                    MIN_LIMIT,
                ),
                MAX_LIMIT,
            );

            const offset = Math.max(
                Number.parseInt(
                    c.req.query("offset") || DEFAULT_OFFSET.toString(),
                    10,
                ),
                DEFAULT_OFFSET,
            );

            c.set("limit", override?.limit ?? limit);
            c.set("offset", override?.offset ?? offset);

            await next();
        }),
    ] as const;
