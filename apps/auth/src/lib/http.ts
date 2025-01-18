import { resolver } from "hono-openapi/zod"
import type { ZodSchema } from "zod"

export interface StatusCodesType {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
}

export const StatusCodes: StatusCodesType = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
}

/**
 * Generates a JSON content object for an HTTP response, including a schema and description.
 *
 * @template T - The type of the Zod schema.
 * @param {T} schema - The Zod schema to be used for validating the JSON content.
 * @param {string} description - A description of the content.
 * @returns {object} An object containing the JSON content type and schema, along with the description.
 */
export const jsonContent = <T extends ZodSchema>(schema: T, description: string) => ({
    content: {
        "application/json": {
            schema: resolver(schema)
        }
    },
    description,
})

/**
 * Creates a JSON content requirement object with a specified schema and description,
 * and marks it as required.
 *
 * @template T - The type of the Zod schema.
 * @param {T} schema - The Zod schema to validate the JSON content.
 * @param {string} description - A description of the JSON content requirement.
 * @returns {object} An object containing the JSON content requirement with the specified schema,
 *                   description, and a `required` flag set to true.
 */
export const jsonContentRequired = <T extends ZodSchema>(schema: T, description: string) => ({
    ...jsonContent(schema, description),
    required: true
})

export const textContent = (description: string) => ({
    content: {
        "text/plain": {
            schema: {
                type: "string"
            }
        }
    },
    description
})