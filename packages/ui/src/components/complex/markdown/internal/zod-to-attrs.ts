import type { z } from "zod";

export type AttrSpec = {
    default: unknown;
};

/**
 * Derive TipTap node-attribute defaults from a Zod object schema.
 *
 * We rely on the schema being object-shaped (every directive has one),
 * `safeParse({})` to produce defaulted attributes, and `_def.shape()` (Zod 4)
 * to enumerate keys. Optional fields default to `null` if the schema has no
 * default for them.
 */
export function attrsFromSchema(schema: z.ZodType): Record<string, AttrSpec> {
    const shape = readShape(schema);
    if (!shape) return {};

    const sample = sampleDefaults(schema);

    const out: Record<string, AttrSpec> = {};
    for (const key of Object.keys(shape)) {
        out[key] = { default: sample[key] ?? null };
    }
    return out;
}

function readShape(schema: z.ZodType): Record<string, z.ZodType> | null {
    const def = (schema as unknown as { _def?: { shape?: unknown } })._def;
    if (!def) return null;
    const shape = def.shape;
    if (typeof shape === "function") {
        try {
            return (shape as () => Record<string, z.ZodType>)();
        } catch {
            return null;
        }
    }
    if (shape && typeof shape === "object") {
        return shape as Record<string, z.ZodType>;
    }
    return null;
}

function sampleDefaults(schema: z.ZodType): Record<string, unknown> {
    const result = (
        schema as unknown as {
            safeParse: (v: unknown) => { success: boolean; data?: unknown };
        }
    ).safeParse({});
    if (result.success && result.data && typeof result.data === "object") {
        return result.data as Record<string, unknown>;
    }
    return {};
}
