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

/**
 * All tags available for API endpoints
 */
const tags = [
    "api-keys",
    "assets",
    "emails",
    "events",
    "master-study",
    "forms",
    "groups",
    "fines",
    "jobs",
    "news",
    "notifications",
    "payments",
    "users",
    "webhooks",
] as const;

/**
 * Further constrains DescribeRouteOptions to increase consistency
 */
type CustomDescribeRouteOptions = {
    operationId: string;
    summary: string;
    description: string;
    tags: (typeof tags)[number][];
} & DescribeRouteOptions;

/**
 * Remove overlapped fields from options passed in as additional options
 */
type AdditionalDescribeRouteOptions = Omit<
    DescribeRouteOptions,
    keyof CustomDescribeRouteOptions
>;

type ResponsesType = NonNullable<DescribeRouteOptions["responses"]>;
type OutputOptions = ResponsesType[keyof ResponsesType];

export class RouteDescriptorBuilder {
    private options: CustomDescribeRouteOptions;

    constructor(options: CustomDescribeRouteOptions) {
        this.options = options;
    }

    /**
     * Define a response that does not need a schema. If you use an output schema, please use [schemaResponse] instead.
     */
    public response({
        statusCode,
        description,
        options = {},
    }: {
        statusCode: StatusCode;
        description: string;
        options?: AdditionalDescribeRouteOptions;
    }) {
        this.options.responses = {
            ...this.options.responses,
            [statusCode]: {
                description,
                ...options,
            },
        };

        return this;
    }

    /**
     * Define a response with a type-safe schema
     */
    public schemaResponse({
        statusCode,
        schema,
        description,
        options = {},
    }: {
        statusCode: StatusCode;
        schema: ZodType;
        description: string;
        options?: AdditionalDescribeRouteOptions & {
            mediaType?: string;
        };
    }) {
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

    /**
     * Define a 400 Bad Request response for this route
     */
    public badRequest({
        description = "",
        options = {},
    }: {
        description?: string;
        options?: Omit<OutputOptions, "description">;
    } = {}) {
        return this.response({
            statusCode: 400,
            description: description
                ? `Bad Request - ${description}`
                : "Bad Request",
            options,
        });
    }

    /**
     * Define a 404 Not Found response for this route
     */
    public notFound({
        description = "",
        options = {},
    }: {
        description?: string;
        options?: Omit<OutputOptions, "description">;
    } = {}) {
        return this.response({
            statusCode: 404,
            description: description
                ? `Not Found - ${description}`
                : "Not Found",
            options,
        });
    }

    /**
     * Define a 403 Forbidden response for this route
     */
    public forbidden({
        description = "",
        options = {},
    }: {
        description?: string;
        options?: Omit<OutputOptions, "description">;
    } = {}) {
        return this.response({
            statusCode: 403,
            description: description
                ? `Forbidden - ${description}`
                : "Forbidden",
            options,
        });
    }

    /**
     * Define a 401 Unauthorized response for this route
     */
    public unauthorized({
        description = "",
        options = {},
    }: {
        description?: string;
        options?: Omit<OutputOptions, "description">;
    } = {}) {
        return this.response({
            statusCode: 401,
            description: description
                ? `Unauthorized - ${description}`
                : "Unauthorized",
            options,
        });
    }

    /**
     * Define custom error responses for this route.
     *
     * You can define known errors by using the HTTPAppException class with named constructors.
     *
     * Example: `.errorResponses({ errors: [HTTPAppException.NotFound("User not found")] })`
     */
    public errorResponses(errors: Error[]) {
        for (const error of errors) {
            if (error instanceof HTTPAppException) {
                this.schemaResponse({
                    statusCode: error.status as StatusCode,
                    schema: httpAppExceptionSchema,
                    description: error.providedMessage,
                });
                continue;
            }

            // Standard Hono HTTP Exception
            // This might sometimes be wrong since it can contain a response object as well
            if (error instanceof HTTPException) {
                this.response({
                    statusCode: error.status as StatusCode,
                    description: error.message,
                    options: {
                        content: {
                            "text/plain": {
                                schema: resolver(z.string()),
                            },
                        },
                    },
                });
            }
            // TODO: Add other error types
        }
        return this;
    }

    /**
     * Build an OpenAPI route description for this API endpoint
     */
    public build() {
        return _describeRoute(this.options);
    }

    /**
     * Get the internal/raw OpenAPI specification options
     */
    public getSpec() {
        return this.options;
    }
}

/**
 * Creates a RouteDescriptorBuilder for API endpoints
 */
export function describeRoute(options: CustomDescribeRouteOptions) {
    return new RouteDescriptorBuilder(options);
}

/**
 * Creates a RouteDescriptorBuilder for middleware
 */
export function describeMiddlewareRoute() {
    // Middlware do not need route required parameters
    return new RouteDescriptorBuilder({} as CustomDescribeRouteOptions);
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
