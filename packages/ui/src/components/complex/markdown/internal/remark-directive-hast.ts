import type { Root } from "mdast";
import type { Directives, TextDirective } from "mdast-util-directive";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

import type { DirectiveRegistry } from "../directive";

const ATTRS_PROP = "dataTihldeAttrs";

export function tagFor(name: string): string {
    return `tihlde-${name}`;
}

export const ATTRS_PROPERTY = ATTRS_PROP;

/**
 * Build a unified plugin that turns mdast directive nodes into hast-friendly
 * elements. Directives whose `name` is in the registry get `data.hName` set
 * to `tihlde-${name}` so react-markdown intercepts them via the components map.
 *
 * Raw attributes are JSON-encoded into a single hProperty so they survive
 * the mdast→hast conversion intact, then re-validated with Zod inside the
 * components map.
 *
 * Unknown *inline* directives are converted back into plain text. Ordinary
 * prose triggers them by accident all the time — "kl 16:15" parses as a text
 * directive named "15" — and without this the ":15" silently disappears and
 * the fallback rendering nests a <div> inside <p> (hydration error). Unknown
 * block directives (leaf/container) are left as-is and render inert.
 */
export function buildRemarkDirectivePlugin(
    registry: DirectiveRegistry,
): Plugin<[], Root> {
    return function remarkTihldeDirective() {
        return (tree) => {
            visit(tree, (node, index, parent) => {
                if (
                    node.type !== "containerDirective" &&
                    node.type !== "leafDirective" &&
                    node.type !== "textDirective"
                ) {
                    return;
                }
                const directive = node as Directives;
                if (!registry.has(directive.name)) {
                    if (
                        directive.type === "textDirective" &&
                        parent &&
                        typeof index === "number"
                    ) {
                        // Restore the literal ":name" text and keep any
                        // [label] children as ordinary inline content.
                        const inline = directive as TextDirective;
                        parent.children.splice(
                            index,
                            1,
                            {
                                type: "text",
                                value: `:${inline.name}`,
                            },
                            ...inline.children,
                        );
                        return [SKIP, index];
                    }
                    return;
                }

                const data = (directive.data ??= {});
                data.hName = tagFor(directive.name);
                data.hProperties = {
                    [ATTRS_PROP]: JSON.stringify(directive.attributes ?? {}),
                };
            });
        };
    };
}
