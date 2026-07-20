import type { ReactNode } from "react";
import type { z } from "zod";
import type { NodeViewProps } from "@tiptap/react";

export type DirectiveKind = "text" | "leaf" | "container";

export type DirectiveRenderProps<TSchema extends z.ZodType> = {
    attrs: z.infer<TSchema>;
    children?: ReactNode;
    text?: string;
};

export type DirectiveEditProps<TSchema extends z.ZodType> = NodeViewProps & {
    attrs: z.infer<TSchema>;
};

export type DirectiveDefinition<TSchema extends z.ZodType = z.ZodType> = {
    name: string;
    kind: DirectiveKind;
    schema: TSchema;
    label: string;
    icon?: ReactNode;
    Render: (props: DirectiveRenderProps<TSchema>) => ReactNode;
    Edit: (props: DirectiveEditProps<TSchema>) => ReactNode;
    inputRule?: RegExp;
};

export type DirectiveRegistry = {
    readonly directives: ReadonlyArray<DirectiveDefinition>;
    get(name: string): DirectiveDefinition | undefined;
    has(name: string): boolean;
};

/**
 * Typed identity helper. Lets a directive author write
 * `defineDirective({ ... })` and get strong inference on `attrs`
 * without manually annotating the schema generic.
 *
 * No side effects — the returned value is just stored or composed
 * into a registry by the consumer.
 */
export function defineDirective<TSchema extends z.ZodType>(
    def: DirectiveDefinition<TSchema>,
): DirectiveDefinition<TSchema> {
    return def;
}
