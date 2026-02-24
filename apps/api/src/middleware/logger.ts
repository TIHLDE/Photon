import { env } from "@photon/core/env";
import type { Context } from "hono";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { requestId as requestIdMiddleware } from "hono/request-id";
import { pino } from "pino";
import type { PrettyOptions } from "pino-pretty";

export type LoggerType = ReturnType<typeof createLogger>;

const debugTransportOptions: PrettyOptions = {
    colorize: true,
};

function createLogger() {
    const isDev = env.NODE_ENV === "development";
    return pino({
        level: isDev ? "debug" : "info",
        timestamp: pino.stdTimeFunctions.isoTime,
        ...(isDev
            ? {
                  transport: {
                      target: "pino-pretty",
                      options: debugTransportOptions,
                  },
              }
            : {}),
    });
}

export const pinoLoggerMiddleware = every(
    requestIdMiddleware(),
    async (c, next) => {
        const requestId = c.var.requestId;
        const method = c.req.method;
        const url = c.req.path;

        const logger = createLogger().child({
            requestId,
            request: {
                method,
                url,
            },
        });
        c.set("logger", logger);

        logger.info(`--> ${method} ${url}`);
        const start = Date.now();
        await next();
        const elapsed = Date.now() - start;
        logger
            .child({ elapsedMs: elapsed })
            .info(`<-- ${method} ${url} (elapsed: ${elapsed}ms)`);
    },
);

/**
 * Middleware to append additional data to the request logger.
 *
 * This middleware enriches the logger context with custom data that will be included
 * in all subsequent log entries for the current request.
 *
 * @param data - Either an object containing the data to append, or a function that
 *               receives the Hono context and returns an object with the data to append.
 *
 * @returns A Hono middleware function that appends the data to the logger.
 *
 * @example
 * // Append static data
 * app.use('/users/*', appendLoggerData({ resource: 'users' }));
 *
 * @example
 * // Append dynamic data based on context
 * app.use('/users/:id', appendLoggerData((c) => ({
 *   userId: c.req.param('id')
 * })));
 *
 * @example
 * // Chain multiple logger data middleware
 * app.use('/api/*', appendLoggerData({ service: 'api' }));
 * app.use('/api/v1/*', appendLoggerData({ version: 'v1' }));
 */
export const appendLoggerData = (data: object | ((c: Context) => object)) =>
    createMiddleware(async (c, next) => {
        const logger: LoggerType = c.get("logger");
        const newData = typeof data === "function" ? data(c) : data;
        c.set("logger", logger.child(newData));
        await next();
    });
