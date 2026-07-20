import { createElement, type ComponentProps, type ReactNode } from "react";
import type { Components } from "react-markdown";

import type { DirectiveRegistry } from "../directive";

import { validateAttrs } from "./parse-attrs";
import { tagFor } from "./remark-directive-hast";

const ATTRS_KEYS = [
    "dataTihldeAttrs",
    "data-tihlde-attrs",
    "dataTihldeattrs",
] as const;

type AnyProps = ComponentProps<"div"> & { node?: unknown };

function parseRawAttrs(props: AnyProps): Record<string, string> {
    const propsRecord = props as Record<string, unknown>;
    let rawValue: unknown;
    for (const key of ATTRS_KEYS) {
        if (typeof propsRecord[key] === "string") {
            rawValue = propsRecord[key];
            break;
        }
    }
    if (typeof rawValue !== "string") return {};
    try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (parsed && typeof parsed === "object") {
            return parsed as Record<string, string>;
        }
        return {};
    } catch {
        return {};
    }
}

/**
 * Build the `components` prop for react-markdown from a directive registry.
 * Each directive becomes one entry keyed on `tihlde-${name}` (matching the
 * hName set by the remark plugin).
 *
 * The render component:
 *  1. Parses raw attrs from the encoded hProperty
 *  2. Validates them through the directive's Zod schema
 *  3. Calls the directive's `Render` with typed attrs
 *  4. Returns null on validation failure (logged in dev)
 */
export function buildComponentsMap(registry: DirectiveRegistry): Components {
    const components: Record<string, (props: AnyProps) => ReactNode> = {};

    for (const directive of registry.directives) {
        const tag = tagFor(directive.name);
        components[tag] = (props) => {
            const raw = parseRawAttrs(props);
            const result = validateAttrs(raw, directive.schema);
            if (!result.success) {
                // oxlint-disable: no-console
                console.warn(
                    `[markdown] invalid attrs for directive "${directive.name}":`,
                    result.error.flatten(),
                );
                return null;
            }
            const children = (props as { children?: ReactNode }).children;
            return createElement(directive.Render, {
                attrs: result.attrs,
                children,
            });
        };
    }

    return components as unknown as Components;
}
