import type { z } from "zod";

export type AttrParseResult<TSchema extends z.ZodType> =
    | { success: true; attrs: z.infer<TSchema> }
    | { success: false; error: z.ZodError };

/**
 * Parse and validate raw directive attributes (always Record<string,string>
 * from remark-directive) against a Zod schema.
 *
 * Coerces strings to numbers/booleans where the schema expects them via
 * Zod's coercion. Unknown keys present in `raw` are dropped silently — the
 * schema decides which keys are kept.
 */
export function validateAttrs<TSchema extends z.ZodType>(
    raw: Record<string, string | null | undefined> | null | undefined,
    schema: TSchema,
): AttrParseResult<TSchema> {
    const input = raw ?? {};
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, attrs: result.data as z.infer<TSchema> };
    }
    return { success: false, error: result.error };
}
