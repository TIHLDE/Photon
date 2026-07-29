"use client";

import * as React from "react";

import { cn } from "#/lib/utils";

/**
 * The shapes images are actually rendered in on the public site.
 *
 * This is the single source of truth: the public cards and the admin upload
 * previews both read from here, which is what makes "what the editor sees" and
 * "what the visitor sees" the same crop by construction rather than by
 * two class strings that happen to agree today.
 *
 * `aspectClassName` must stay a literal Tailwind class — the scanner reads
 * this file, so a computed string would not produce any CSS.
 */
export type ImagePresetDefinition = {
    /** Human label, shown to editors above the preview. */
    label: string;
    /** What the editor should know about how this crop behaves. */
    hint: string;
    /**
     * Tailwind aspect-ratio class, or `null` for surfaces that render the
     * image at its own proportions.
     */
    aspectClassName: string | null;
    /** How the image fills its box on the public site. */
    fit: "cover" | "contain";
    /** Size we ask editors to aim for, in CSS pixels. */
    recommended: { width: number; height: number } | null;
};

export const IMAGE_PRESETS = {
    /**
     * Nyheter, arrangementer and jobbannonser. Used by NewsCard, ListCard and
     * DetailHero — every one of them 16/7.
     */
    "cover-wide": {
        label: "Bredt forsidebilde",
        hint: "Vises i 16:7 på kort og øverst på siden. Alt utenfor rammen blir beskåret.",
        aspectClassName: "aspect-[16/7]",
        fit: "cover",
        recommended: { width: 1600, height: 700 },
    },
    /** Galleriforsider and bedriftstilbud — 16/9. */
    "cover-video": {
        label: "Forsidebilde 16:9",
        hint: "Vises i 16:9. Alt utenfor rammen blir beskåret.",
        aspectClassName: "aspect-video",
        fit: "cover",
        recommended: { width: 1600, height: 900 },
    },
    /** Töddel-forsider — portrait, like a printed magazine cover. */
    "cover-portrait": {
        label: "Forsidebilde i høydeformat",
        hint: "Vises i 3:4, som en bladforside. Alt utenfor rammen blir beskåret.",
        aspectClassName: "aspect-[3/4]",
        fit: "cover",
        recommended: { width: 1200, height: 1600 },
    },
    /** Gruppelogoer and profilbilder — square, usually inside an Avatar. */
    avatar: {
        label: "Kvadratisk bilde",
        hint: "Vises kvadratisk, ofte i en sirkel. Hold motivet midt i bildet.",
        aspectClassName: "aspect-square",
        fit: "cover",
        recommended: { width: 512, height: 512 },
    },
    /** Galleribilder — shown at their own proportions in the masonry grid. */
    natural: {
        label: "Bilde",
        hint: "Vises i sitt eget format, uten beskjæring.",
        aspectClassName: null,
        fit: "contain",
        recommended: null,
    },
} as const satisfies Record<string, ImagePresetDefinition>;

export type ImagePresetName = keyof typeof IMAGE_PRESETS;

export function getImagePreset(name: ImagePresetName): ImagePresetDefinition {
    return IMAGE_PRESETS[name];
}

export interface ImagePresetFrameProps extends Omit<
    React.ComponentProps<"img">,
    "children"
> {
    preset: ImagePresetName;
    /** Rendered instead of the image when there is no `src`. */
    fallback?: React.ReactNode;
    /** Overlaid on top of the image, e.g. a "replace" button. */
    overlay?: React.ReactNode;
    containerClassName?: string;
}

/**
 * Renders an image in exactly the frame a given surface uses in production.
 *
 * Public components should use this instead of hand-writing an aspect class,
 * so that changing a crop changes it everywhere — including in the admin
 * preview — at once.
 */
export function ImagePresetFrame({
    preset,
    src,
    alt = "",
    fallback,
    overlay,
    className,
    containerClassName,
    ...rest
}: ImagePresetFrameProps) {
    const { aspectClassName, fit } = IMAGE_PRESETS[preset];

    return (
        <div
            className={cn(
                "relative w-full overflow-hidden rounded-lg bg-muted",
                aspectClassName,
                containerClassName,
            )}
        >
            {src ? (
                <img
                    {...rest}
                    src={src}
                    alt={alt}
                    className={cn(
                        aspectClassName
                            ? "absolute inset-0 size-full"
                            : "block h-auto w-full",
                        fit === "cover" ? "object-cover" : "object-contain",
                        className,
                    )}
                />
            ) : (
                <div
                    className={cn(
                        "flex items-center justify-center text-sm text-muted-foreground",
                        aspectClassName ? "absolute inset-0" : "py-10",
                    )}
                >
                    {fallback}
                </div>
            )}
            {overlay}
        </div>
    );
}
