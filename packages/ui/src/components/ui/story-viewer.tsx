"use client";

import * as React from "react";
import { ChevronRight, ChevronUp, Heart } from "lucide-react";

import { cn } from "#/lib/utils";

/**
 * A full-screen, vertical story: one slide fills the screen, and swiping up
 * or down snaps to the next or previous one, like TikTok and Reels.
 *
 * Built on CSS scroll snapping rather than a gesture library, so touch
 * momentum, keyboard scrolling and screen readers all work the way the
 * browser already makes them work.
 */

/**
 * The backdrop: black in both themes, with the dark theme switched on inside
 * so cards and sheets opened over it stay readable. Owns the dynamic viewport
 * (`dvh`), so iOS Safari's toolbars never cover the bottom of a slide.
 */
function StoryViewer({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-viewer"
            className={cn(
                "dark relative h-dvh overflow-hidden bg-black text-white",
                className,
            )}
            {...props}
        />
    );
}

/**
 * The scroll container. `overscroll-contain` keeps a swipe past the last slide
 * from turning into pull-to-refresh or scrolling the page behind it.
 */
function StoryFeed({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-feed"
            className={cn(
                "h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className,
            )}
            {...props}
        />
    );
}

/**
 * One screen of the story. `snap-always` stops a fast flick skipping slides;
 * `touch-manipulation` turns off double-tap zoom, so a double tap can like.
 */
function StorySlide({ className, ...props }: React.ComponentProps<"section">) {
    return (
        <section
            data-slot="story-slide"
            className={cn(
                "relative flex h-dvh w-full touch-manipulation snap-start snap-always items-center justify-center overflow-hidden",
                className,
            )}
            {...props}
        />
    );
}

/**
 * One card of the card layout: the same content as a {@link StorySlide},
 * on a rounded card that sits in a {@link SwipeCardStack} instead of filling
 * the screen. `touch-manipulation` for the same reason as on a slide.
 */
function StoryCard({ className, ...props }: React.ComponentProps<"section">) {
    return (
        <section
            data-slot="story-card"
            className={cn(
                "relative flex size-full touch-manipulation items-center justify-center overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl ring-1 ring-white/10",
                className,
            )}
            {...props}
        />
    );
}

/**
 * Where the card stack sits: below the top bar, clear of the notch and the
 * home indicator, and no wider than a phone so a card keeps its shape on a
 * laptop.
 */
function StoryCardArea({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-card-area"
            className={cn(
                "mx-auto flex h-dvh w-full max-w-md flex-col px-3 pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]",
                className,
            )}
            {...props}
        />
    );
}

/** The photo of a slide, whole: never cropped to fill the screen. */
function StoryImage({ className, alt, ...props }: React.ComponentProps<"img">) {
    return (
        <img
            data-slot="story-image"
            alt={alt}
            draggable={false}
            className={cn("size-full object-contain select-none", className)}
            {...props}
        />
    );
}

/** The bar over the top of the story: close on the left, a title, an action. */
function StoryTopBar({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-top-bar"
            className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2 bg-linear-to-b from-black/60 to-transparent px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-8 *:pointer-events-auto",
                className,
            )}
            {...props}
        />
    );
}

function StoryTitle({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="story-title"
            className={cn(
                "min-w-0 truncate text-center text-sm font-semibold",
                className,
            )}
            {...props}
        />
    );
}

/**
 * The cover slide's background: the event's image, dimmed so the title over
 * it stays readable whatever the picture.
 */
function StoryCoverImage({
    className,
    alt = "",
    ...props
}: React.ComponentProps<"img">) {
    return (
        <img
            data-slot="story-cover-image"
            alt={alt}
            draggable={false}
            className={cn(
                "absolute inset-0 size-full object-cover opacity-50 select-none",
                className,
            )}
            {...props}
        />
    );
}

function StoryCoverContent({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-cover-content"
            className={cn(
                "relative z-10 flex max-w-lg flex-col items-center gap-3 px-6 text-center",
                className,
            )}
            {...props}
        />
    );
}

function StoryCoverEyebrow({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="story-cover-eyebrow"
            className={cn(
                "text-xs font-semibold tracking-widest text-white/80 uppercase",
                className,
            )}
            {...props}
        />
    );
}

function StoryCoverTitle({ className, ...props }: React.ComponentProps<"h1">) {
    return (
        <h1
            data-slot="story-cover-title"
            className={cn(
                "text-3xl font-bold text-balance sm:text-4xl",
                className,
            )}
            {...props}
        />
    );
}

function StoryCoverMeta({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="story-cover-meta"
            className={cn("text-sm text-white/80", className)}
            {...props}
        />
    );
}

/**
 * "Sveip opp" at the bottom of the cover, nudging upwards. A real button, so
 * a mouse or a keyboard can take the step a finger takes by swiping.
 */
function StorySwipeHint({
    className,
    children,
    direction = "up",
    ...props
}: React.ComponentProps<"button"> & {
    /** Which way the swipe goes: up in the feed, right in the card stack. */
    direction?: "up" | "right";
}) {
    const Arrow = direction === "right" ? ChevronRight : ChevronUp;
    return (
        <button
            type="button"
            data-slot="story-swipe-hint"
            className={cn(
                "absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1.5rem)] z-10 mx-auto flex w-fit cursor-pointer flex-col items-center gap-1 rounded-full px-4 py-2 text-xs text-white/80 outline-none focus-visible:ring-3 focus-visible:ring-white/60 motion-safe:animate-bounce",
                className,
            )}
            {...props}
        >
            <Arrow className="size-5" aria-hidden />
            {children}
        </button>
    );
}

/**
 * The strip along the bottom of a photo: who took it, over a gradient that
 * keeps the text readable on a bright photo. Leaves room on the right for
 * {@link StoryActions}.
 */
function StoryCaption({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-caption"
            className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-linear-to-t from-black/70 to-transparent pt-20 pr-20 pb-[max(env(safe-area-inset-bottom),1.25rem)] pl-4 text-sm",
                className,
            )}
            {...props}
        />
    );
}

/** The column of buttons on the right of a photo: like, comment. */
function StoryActions({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="story-actions"
            className={cn(
                "absolute right-2 bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-20 flex flex-col items-center gap-4",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A round button with its count under it. `aria-pressed` marks it active —
 * for the like button, a filled red heart.
 */
function StoryActionButton({
    className,
    count,
    children,
    ...props
}: React.ComponentProps<"button"> & { count?: React.ReactNode }) {
    return (
        <button
            type="button"
            data-slot="story-action-button"
            className={cn(
                "group/story-action flex cursor-pointer flex-col items-center gap-1 text-xs font-semibold text-white outline-none disabled:pointer-events-none disabled:opacity-40",
                className,
            )}
            {...props}
        >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-focus-visible/story-action:ring-3 group-focus-visible/story-action:ring-white/60 group-active/story-action:scale-90 group-aria-pressed/story-action:text-red-500 motion-reduce:transition-none [&_svg]:size-6 group-aria-pressed/story-action:[&_svg]:fill-current">
                {children}
            </span>
            {count === undefined ? null : <span>{count}</span>}
        </button>
    );
}

/** The heart that pops up where a photo was double-tapped to like it. */
function StoryHeartBurst({ className, ...props }: React.ComponentProps<"svg">) {
    return (
        <Heart
            data-slot="story-heart-burst"
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-0 z-10 m-auto size-28 animate-in fill-current text-white drop-shadow-lg duration-300 zoom-in-50 fade-in",
                className,
            )}
            {...props}
        />
    );
}

export {
    StoryCard,
    StoryCardArea,
    StoryActionButton,
    StoryActions,
    StoryCaption,
    StoryCoverContent,
    StoryCoverEyebrow,
    StoryCoverImage,
    StoryCoverMeta,
    StoryCoverTitle,
    StoryFeed,
    StoryHeartBurst,
    StoryImage,
    StorySlide,
    StorySwipeHint,
    StoryTitle,
    StoryTopBar,
    StoryViewer,
};
