import {
    type DescribeRouteOptions,
    describeRoute as _describeRoute,
    resolver,
} from "hono-openapi";
import type { StatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod/v4";

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
        description: string = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            400,
            description ? `Bad Request - ${description}` : "Bad Request",
            options,
        );
    }

    public notFound(
        description: string = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            404,
            description ? `Not Found - ${description}` : "Not Found",
            options,
        );
    }

    public forbidden(
        description: string = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            403,
            description ? `Forbidden - ${description}` : "Forbidden",
            options,
        );
    }

    public unauthorized(
        description: string = "",
        options: Omit<OutputOptions, "description"> = {},
    ) {
        return this.response(
            401,
            description ? `Unauthorized - ${description}` : "Unauthorized",
            options,
        );
    }

    public build() {
        return _describeRoute(this.options);
    }
}

export function describeRoute(options: DescribeRouteOptions) {
    return new RouteDescriptorBuilder(options);
}

export function describeAuthenticatedRoute(options: DescribeRouteOptions) {
    return new RouteDescriptorBuilder(options).unauthorized(
        "Missing authorization header",
    );
}
