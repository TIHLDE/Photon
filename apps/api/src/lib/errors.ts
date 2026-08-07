import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import z from "zod";
import { env } from "./env";

/**
 * Domain-level validation error for use in service/domain layers.
 * The global error handler converts this to a 422 HTTP response.
 *
 * Use this when input validation fails at the service layer (not Zod schema validation).
 */
export class ValidationError extends Error {
    public readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);
        this.name = "ValidationError";
        this.details = details;
    }
}

/**
 * Standardized error response schema for the API.
 * All errors should follow this format for consistent frontend handling.
 */
export const httpAppExceptionSchema = z.object({
    status: z.number().describe("The HTTP status code").meta({ example: 401 }),
    message: z.string().describe("The error message"),
    meta: z.any().describe("Additional metadata about the error").optional(),
});

export type HttpAppExceptionData = z.infer<typeof httpAppExceptionSchema>;

/**
 * Custom HTTP exception with standardized JSON response format.
 * Use this instead of Hono's HTTPException for consistent error responses.
 */
export class HTTPAppException extends HTTPException {
    public providedMessage: string;
    public meta?: unknown;

    constructor(data: HttpAppExceptionData) {
        const { status } = data;
        super(status as ContentfulStatusCode, {
            res: new Response(
                JSON.stringify(httpAppExceptionSchema.parse(data)),
                {
                    status,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        });

        this.providedMessage = data.message;
        this.meta = data.meta;
    }

    // =========================================================================
    // Factory methods for common errors
    // =========================================================================

    /** 400 Bad Request */
    public static BadRequest(message = "Bad request", meta?: unknown) {
        return new HTTPAppException({ status: 400, message, meta });
    }

    /** 401 Unauthorized */
    public static Unauthorized(message = "Authentication required") {
        return new HTTPAppException({ status: 401, message });
    }

    /** 403 Forbidden */
    public static Forbidden(
        message = "You don't have permission to access this resource",
    ) {
        return new HTTPAppException({ status: 403, message });
    }

    /** 404 Not Found */
    public static NotFound(resource = "Resource") {
        return new HTTPAppException({
            status: 404,
            message: `${resource} not found`,
        });
    }

    /** 409 Conflict */
    public static Conflict(message = "Resource already exists") {
        return new HTTPAppException({ status: 409, message });
    }

    /** 422 Unprocessable Entity (validation errors) */
    public static ValidationError(
        message = "Validation failed",
        errors?: unknown,
    ) {
        return new HTTPAppException({
            status: 422,
            message,
            meta: errors,
        });
    }

    /** 500 Internal Server Error */
    public static InternalError(message = "Internal server error") {
        return new HTTPAppException({ status: 500, message });
    }
}

/**
 * PostgreSQL error code for a unique-constraint violation.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * True when `err` — or anything it wraps — is a PostgreSQL unique-constraint
 * violation.
 *
 * Walks the cause chain because Drizzle wraps driver errors in a
 * `DrizzleQueryError` that carries the `pg` error as `cause`, so the `code`
 * is never on the error we are handed.
 */
function isUniqueViolation(err: unknown): boolean {
    let current: unknown = err;
    for (let depth = 0; current && depth < 5; depth++) {
        if (
            typeof current === "object" &&
            (current as { code?: unknown }).code === PG_UNIQUE_VIOLATION
        ) {
            return true;
        }
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/**
 * Global error handler for Hono apps.
 * Normalizes all errors to the standard response format.
 *
 * @example
 * const app = new Hono();
 * app.onError(globalErrorHandler);
 */
export function globalErrorHandler(err: Error, c: Context): Response {
    // Already a properly formatted HTTPAppException
    if (err instanceof HTTPAppException) {
        return err.getResponse();
    }

    // Domain-level validation errors (from service layer)
    if (err instanceof ValidationError) {
        const response: HttpAppExceptionData = {
            status: 422,
            message: err.message,
            meta: err.details,
        };
        return c.json(response, 422);
    }

    // Zod validation errors
    if (err instanceof z.ZodError) {
        const response: HttpAppExceptionData = {
            status: 422,
            message: "Validation failed",
            meta: err.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        };
        return c.json(response, 422);
    }

    // Hono's HTTPException (from middleware or other sources)
    if (err instanceof HTTPException) {
        const response: HttpAppExceptionData = {
            status: err.status,
            message: err.message || "An error occurred",
        };
        return c.json(response, err.status);
    }

    /**
     * A unique index the code failed to check first is a conflict, not a
     * server fault. Answering 500 here hands the caller "Internal server
     * error" for something the user could act on — which is exactly how a
     * student registering with an already-taken NTNU username ended up with an
     * unreadable error instead of "log in instead" (issue #476).
     *
     * A safety net, not a substitute for checking: the message cannot say
     * WHICH value collided without leaking column names, so routes should
     * still look the conflict up and answer with something specific.
     */
    if (isUniqueViolation(err)) {
        console.error("Unique constraint violation reached the handler:", err);
        const response: HttpAppExceptionData = {
            status: 409,
            message: "Ressursen finnes allerede",
        };
        return c.json(response, 409);
    }

    // Unexpected errors - log and return generic message
    console.error("Unhandled error:", err);

    const response: HttpAppExceptionData = {
        status: 500,
        message:
            env.NODE_ENV === "production"
                ? "Internal server error"
                : err.message || "Internal server error",
        meta: env.NODE_ENV === "production" ? undefined : { stack: err.stack },
    };
    return c.json(response, 500);
}

/**
 * Not found handler for Hono apps.
 *
 * @example
 * const app = new Hono();
 * app.notFound(notFoundHandler);
 */
export function notFoundHandler(c: Context): Response {
    const response: HttpAppExceptionData = {
        status: 404,
        message: `Route not found: ${c.req.method} ${c.req.path}`,
    };
    return c.json(response, 404);
}
