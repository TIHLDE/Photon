import { Node, type Extensions, type NodeConfig } from "@tiptap/core";
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { createElement, type ReactNode } from "react";

import type {
    DirectiveDefinition,
    DirectiveKind,
    DirectiveRegistry,
} from "../directive";

import { attrsFromSchema } from "./zod-to-attrs";

export type BuildOptions = {
    placeholder?: string;
};

/**
 * Build the TipTap extension array for the rich editor.
 *
 * Base extensions (StarterKit + Link + Placeholder) plus one custom Node
 * per directive in the registry. Directive nodes:
 *  - Use the directive's Zod schema to derive their attribute defaults.
 *  - Render through the directive's `Edit` React component via NodeView.
 *  - Use group/content/inline/atom rules driven by the directive `kind`.
 */
export function buildTiptapExtensions(
    registry: DirectiveRegistry,
    options: BuildOptions = {},
): Extensions {
    const base: Extensions = [
        StarterKit.configure({
            link: false,
            heading: { levels: [1, 2, 3, 4, 5, 6] },
        }),
        Link.configure({
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        }),
        Placeholder.configure({
            placeholder: options.placeholder ?? "Start writing…",
        }),
    ];

    const directiveExtensions = registry.directives.map((directive) =>
        buildDirectiveNode(directive),
    );

    return [...base, ...directiveExtensions];
}

function buildDirectiveNode(definition: DirectiveDefinition): Node {
    const attrSpecs = attrsFromSchema(definition.schema);

    const config: NodeConfig = {
        name: `directive-${definition.name}`,
        group: groupFor(definition.kind),
        inline: definition.kind === "text",
        atom: definition.kind === "leaf",
        defining: definition.kind === "container",
        selectable: definition.kind !== "text",
        draggable: definition.kind !== "text",
        ...(definition.kind !== "leaf" && {
            content: contentFor(definition.kind),
        }),
        addAttributes() {
            return attrSpecs;
        },
        parseHTML() {
            return [{ tag: tagName(definition.name) }];
        },
        renderHTML({ HTMLAttributes }) {
            if (definition.kind === "leaf") {
                return [tagName(definition.name), HTMLAttributes];
            }
            return [tagName(definition.name), HTMLAttributes, 0];
        },
        addNodeView() {
            return ReactNodeViewRenderer(makeEditWrapper(definition));
        },
    };

    return Node.create(config);
}

function makeEditWrapper(definition: DirectiveDefinition) {
    function EditWrapper(props: NodeViewProps): ReactNode {
        const raw = props.node.attrs ?? {};
        const result = definition.schema.safeParse(raw);
        const attrs = result.success
            ? result.data
            : definition.schema.parse({});
        return createElement(definition.Edit, { ...props, attrs });
    }
    EditWrapper.displayName = `DirectiveEdit(${definition.name})`;
    return EditWrapper;
}

function tagName(directiveName: string): string {
    return `tihlde-${directiveName}`;
}

function groupFor(kind: DirectiveKind): string {
    return kind === "text" ? "inline" : "block";
}

function contentFor(kind: DirectiveKind): string {
    if (kind === "container") return "block+";
    return "inline*";
}
