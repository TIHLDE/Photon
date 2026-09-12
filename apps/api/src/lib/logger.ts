import { format } from "node:util";
import { writeSync } from "node:fs";
import { pino, stdSerializers, destination } from "pino";

/**
 * Postgres puts the conflicting VALUES in `error.detail` ("Key (email)=(...)
 * already exists"), and pino's serializer copies every own property of the
 * error, so logging one whole would put a member's address in Loki. Hence an
 * allowlist: fields not named here are dropped, including ones added later.
 */
const LOGGED_ERROR_FIELDS = [
    "code",
    "constraint",
    "table",
    "status",
    "statusCode",
] as const;

const MAX_CAUSE_DEPTH = 3;

export function serializeError(value: unknown, depth = 0): object {
    if (!(value instanceof Error)) {
        return { type: "NonError", message: format(value) };
    }

    const { type, message, stack } = stdSerializers.err(value);
    const serialized: Record<string, unknown> = { type, message, stack };

    for (const field of LOGGED_ERROR_FIELDS) {
        const fieldValue = (value as unknown as Record<string, unknown>)[field];
        if (fieldValue !== undefined) serialized[field] = fieldValue;
    }

    if (value.cause instanceof Error && depth < MAX_CAUSE_DEPTH) {
        serialized.cause = serializeError(value.cause, depth + 1);
    }

    return serialized;
}

// Read the runtime environment object: Bun replaces direct NODE_ENV accesses
// with the build-time value, which could otherwise ship pretty output.
const { NODE_ENV } = process.env;
const isDev = NODE_ENV === "development";
export const logger = pino(
    {
        // Tests that inspect logs provide their own logger with an in-memory sink.
        level: NODE_ENV === "test" ? "silent" : isDev ? "debug" : "info",
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            pid: process.pid,
            service: "photon-api",
            version: process.env.APP_VERSION || "unknown",
            commit: process.env.GIT_SHA || "unknown",
        },
        serializers: { err: serializeError },
        ...(isDev
            ? {
                  transport: {
                      target: "pino-pretty",
                      options: { colorize: true },
                  },
              }
            : {}),
    },
    // Write each record directly to the container's stdout.
    ...(isDev ? [] : [destination({ dest: 1, sync: true })]),
);

export type LoggerType = typeof logger;

// Do not let the error-reporting path raise another application exception.
function writeLog(write: () => void): void {
    try {
        write();
    } catch {
        if (NODE_ENV === "test") return;
        try {
            // Avoid console.{log|warn|error} and go straight to stdout
            writeSync(
                1,
                "Could not write log record; original details unavailable\n",
            );
        } catch {
            // There is no safe output destination left.
        }
    }
}

let installed = false;
export function installErrorInterceptors() {
    if (installed) return;
    installed = true;

    // Override console.log, console.warn and console.error to use pino logger
    for (const method of ["log", "warn", "error"] as const) {
        const level = method === "log" ? "info" : method;
        console[method] = (...args: unknown[]) =>
            writeLog(() => {
                const errors = args.filter((arg) => arg instanceof Error);
                const messageArgs = args.map((arg) =>
                    arg instanceof Error ? arg.message : arg,
                );

                // use the root pino logger to log the output
                logger[level](
                    {
                        event: `console.${method}`,
                        ...(errors.length ? { err: errors[0] } : {}),
                        ...(errors.length > 1
                            ? { errors: errors.slice(1).map(serializeError) }
                            : {}),
                    },
                    format(...messageArgs),
                );
            });
    }

    // Preserve the existing server recovery policy. These are a last-resort
    // safety net; expected failures belong in their request/job handlers.
    process.on("unhandledRejection", (reason) =>
        writeLog(() => {
            logger.error(
                { event: "process.unhandledRejection", err: reason },
                "Unhandled promise rejection",
            );
        }),
    );
    process.on("uncaughtException", (error) =>
        writeLog(() => {
            logger.error(
                { event: "process.uncaughtException", err: error },
                "Uncaught exception",
            );
        }),
    );
    process.on("warning", (warning) =>
        writeLog(() => {
            logger.warn(
                { event: "process.warning", err: warning },
                warning.message,
            );
        }),
    );
}
