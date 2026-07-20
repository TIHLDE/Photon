import type { Root } from "mdast";
import type { Directives } from "mdast-util-directive";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

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
 * Unknown directives (not in the registry) are left as-is — react-markdown
 * will skip rendering them, effectively making them inert.
 */
export function buildRemarkDirectivePlugin(
    registry: DirectiveRegistry,
): Plugin<[], Root> {
    return function remarkTihldeDirective() {
        return (tree) => {
            visit(tree, (node) => {
                if (
                    node.type !== "containerDirective" &&
                    node.type !== "leafDirective" &&
                    node.type !== "textDirective"
                ) {
                    return;
                }
                const directive = node as Directives;
                if (!registry.has(directive.name)) return;

                const data = (directive.data ??= {});
                data.hName = tagFor(directive.name);
                data.hProperties = {
                    [ATTRS_PROP]: JSON.stringify(directive.attributes ?? {}),
                };
            });
        };
    };
}
