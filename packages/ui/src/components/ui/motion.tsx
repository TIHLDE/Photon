import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "#/lib/utils";

/**
 * Entrance motion for content that mounts.
 *
 * Both components are markup-free: they render *as* the element you pass to
 * `render`, so dropping one around an existing `<ul className="grid …">`
 * changes no layout and adds no wrapper node. The animation itself lives in
 * `styles.css` next to the easing tokens, keyed off the `data-slot` these set
 * — that keeps timing in one place and keeps consuming apps free of animation
 * classes (see apps/kvark/CLAUDE.md, which forbids them outright).
 *
 * These re-run whenever the element mounts, which is what makes them work with
 * Suspense and with client-side navigation: a section that streams in late
 * animates when its data lands, not when the document first parsed.
 */

type MotionProps = React.ComponentProps<"div"> & {
    render?: useRender.RenderProp;
};

/**
 * Fades a single element up on mount.
 *
 * ```tsx
 * <Reveal render={<section className="flex flex-col gap-4" />}>…</Reveal>
 * ```
 *
 * Tune per instance with `--reveal-duration` / `--reveal-distance`.
 */
function Reveal({ className, render, ...props }: MotionProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            "data-slot": "reveal",
            className: cn(className),
            ...props,
        },
    });
}

/**
 * Fades this element's direct children up on mount, each a beat after the one
 * before it. Use it on the list or grid itself so the children it staggers are
 * the cards:
 *
 * ```tsx
 * <Stagger render={<ul className="grid gap-4 sm:grid-cols-2" />}>
 *     {items.map((item) => <li key={item.id}>…</li>)}
 * </Stagger>
 * ```
 *
 * The step is 40ms, capped at 8 children; `--reveal-step` overrides it.
 */
function Stagger({ className, render, ...props }: MotionProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            "data-slot": "stagger",
            className: cn(className),
            ...props,
        },
    });
}

export { Reveal, Stagger };
