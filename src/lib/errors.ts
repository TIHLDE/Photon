import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import z from "zod";

export class HTTPAppException extends HTTPException {
    public providedMessage: string;
    constructor(data: z.infer<typeof httpAppExceptionSchema>) {
        const { status } = data;
        super(status as ContentfulStatusCode, {
            res: new Response(
                JSON.stringify(httpAppExceptionSchema.parse(data)),
                { status, headers: { "Content-Type": "application/json" } },
            ),
        });

        this.providedMessage = data.message;
    }

    // Very common errors that doesn't have dynamic data, and can be reused
    public static Unauthorized(message = "Authentication required") {
        return new HTTPAppException({
            status: 401,
            message,
        });
    }
}

export const httpAppExceptionSchema = z.object({
    status: z.number().describe("The HTTP status code").meta({ example: 401 }),
    message: z.string().describe("The error message"),
    meta: z.any().describe("Additional metadata about the error").optional(),
});
