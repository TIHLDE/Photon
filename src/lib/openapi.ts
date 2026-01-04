import type { MiddlewareHandler } from "hono";
import {
    type DescribeRouteOptions,
    describeRoute as _describeRoute,
    resolver,
    uniqueSymbol,
} from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { type ZodType, z } from "zod/v4";
import { HTTPAppException, httpAppExceptionSchema } from "./errors";

type ResponsesType = NonNullable<DescribeRouteOptions["responses"]>;
type OutputOptions = ResponsesType[keyof ResponsesType];

export class RouteDescriptorBuilder {
    private options: DescribeRouteOptions;

    constructor(options: DescribeRouteOptions) {
        this.options = options;
    }

    public response(
        statusCode: StatusCode,
        description: string,
        options: Omit<OutputOptions, "description"> = {},
    ) {
        this.options.responses = {
            ...this.options.responses,
            [statusCode]: {
                description,
                ...options,
            },
        };
        return this;
    }

    public schemaResponse(
        statusCode: StatusCode,
        schema: ZodType,
        description = "",
        options: Omit<OutputOptions, "description"> & {
            mediaType?: string;
        } = {},
    ) {
        const desc = description || undefined;
        const { mediaType = "application/json", ...rest } = options;
        const content =
            schema == null
                ? undefined
                : {
                      content: {
                          [mediaType]: {
                              schema: resolver(schema),
                          },
                      },
                  };

        this.options.responses = {
            ...this.options.responses,
            [statusCode]: {
                description: desc,
                ...rest,
                ...content,
            },
        };

        return this;
    }

    public badRequest(
        description = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            400,
            description ? `Bad Request - ${description}` : "Bad Request",
            options,
        );
    }

    public notFound(
        description = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            404,
            description ? `Not Found - ${description}` : "Not Found",
            options,
        );
    }

    public forbidden(
        description = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            403,
            description ? `Forbidden - ${description}` : "Forbidden",
            options,
        );
    }

    public unauthorized(
        description = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            401,
            description ? `Unauthorized - ${description}` : "Unauthorized",
            options,
        );
    }

    public errorResponses(errorResponses: Error[]) {
        for (const error of errorResponses) {
            if (error instanceof HTTPAppException) {
                this.schemaResponse(
                    error.status as StatusCode,
                    httpAppExceptionSchema,
                    error.providedMessage,
                );
                continue;
            }

            // Standard Hono HTTP Exception
            // This might sometimes be wrong since it can contain a response object as well
            if (error instanceof HTTPException) {
                this.response(error.status as StatusCode, error.message, {
                    content: {
                        "text/plain": {
                            schema: resolver(z.string()),
                        },
                    },
                });
            }
            // TODO: Add other error types
        }
        return this;
    }

    public build() {
        return _describeRoute(this.options);
    }

    public getSpec() {
        return this.options;
    }
}

export function describeRoute(options: DescribeRouteOptions = {}) {
    return new RouteDescriptorBuilder(options);
}

export function describeMiddleware<T extends MiddlewareHandler>(
    middleware: T,
    spec: DescribeRouteOptions,
): T {
    return Object.assign(middleware, {
        [uniqueSymbol]: {
            spec,
        },
    });
}
