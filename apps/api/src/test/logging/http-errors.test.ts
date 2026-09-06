import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { pino } from "pino";
import { describe, expect, test } from "vitest";
import { globalErrorHandler, HTTPAppException } from "~/lib/errors";
import { serializeError, type LoggerType } from "~/lib/logger";

describe("HTTP error logging", () => {
    test.each([
        new Error("unexpected failure"),
        new HTTPException(503, { message: "unavailable" }),
        HTTPAppException.InternalError("internal failure"),
    ])(
        "logs server errors once with request context and preserves the response",
        async (err) => {
            const records: Record<string, unknown>[] = [];
            const logger = pino(
                { serializers: { err: serializeError } },
                {
                    write(line: string) {
                        records.push(JSON.parse(line));
                    },
                },
            ).child({
                requestId: "request-test",
                request: { method: "GET", url: "/failure" },
            });
            const app = new Hono<{ Variables: { logger: LoggerType } }>()
                .use(async (c, next) => {
                    // The production request middleware supplies this child logger.
                    c.set("logger", logger);
                    await next();
                })
                .get("/failure", () => {
                    throw err;
                })
                .onError(globalErrorHandler);
            const response = await app.request("/failure");
            const status = err instanceof HTTPException ? err.status : 500;
            expect(response.status).toBe(status);
            expect(records).toHaveLength(1);
            const message =
                err instanceof HTTPAppException
                    ? err.providedMessage
                    : err.message;
            expect(records[0]).toMatchObject({
                level: 50,
                event: "http.error",
                status,
                requestId: "request-test",
                msg: err instanceof HTTPException ? message : "Unhandled error",
                err: {
                    message,
                    stack: expect.stringContaining("http-errors.test.ts"),
                },
            });
        },
    );
});
