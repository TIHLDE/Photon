"use client";

import * as React from "react";

import { cn } from "#/lib/utils";

/**
 * A stack of cards swiped to the side, like Tinder. The top card follows the
 * finger or the mouse with a slight tilt, and the card it will reveal waits
 * behind it, slightly smaller, growing into place as the top card is dragged
 * away.
 *
 * The two directions mirror each other. Dragging right uncovers the next
 * card, and letting go flies the top card out to the right. Dragging left
 * uncovers the previous card, and letting go flies the top card out to the
 * left. On the first card there is nothing before it, so a swipe to the left
 * springs back.
 *
 * Controlled: the parent owns `index` and changes it in `onIndexChange`. A
 * change made from outside — a key press, a button — animates the same way
 * as a swipe.
 */

type SwipeCardStackProps = Omit<React.ComponentProps<"div">, "children"> & {
    /** Every card, in order. Only the top one, the ones behind it and a departing one are mounted. */
    cards: readonly React.ReactNode[];
    index: number;
    onIndexChange: (index: number) => void;
};

/** How far a card must travel, as a share of the stack's width, to count. */
const SWIPE_SHARE = 0.25;
/** A flick faster than this, in pixels per millisecond, counts at any distance. */
const FLICK_SPEED = 0.5;
/** A flick must still move at least this far, so a tap is never a swipe. */
const FLICK_MIN_PX = 30;
/** Degrees of tilt when the card has travelled one full width. */
const TILT_DEG = 18;
const DURATION_MS = 300;
/** Cards waiting behind the top one while it is dragged to the right. */
const AHEAD = 2;

/**
 * The pointer is captured only once it has moved this far. Capturing at once
 * would send every `pointerup` to the stack instead of the card's content,
 * and a double tap on the photo would never reach it.
 */
const CAPTURE_AFTER_PX = 6;

type Drag = {
    pointerId: number;
    startX: number;
    startTime: number;
    captured: boolean;
};

/** The card flying out, and which way: 1 to the right, -1 to the left. */
type Departure = { index: number; fromX: number; direction: 1 | -1 };

type Mounted = {
    cardIndex: number;
    role: "behind" | "top" | "out";
    depth: number;
};

function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

function SwipeCardStack({
    cards,
    index,
    onIndexChange,
    className,
    ...props
}: SwipeCardStackProps) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const drag = React.useRef<Drag | null>(null);
    const [dx, setDx] = React.useState(0);
    const [dragging, setDragging] = React.useState(false);
    // The card that just flew out, kept until its animation ends.
    const [departing, setDeparting] = React.useState<Departure | null>(null);
    // Where the finger let go, so the card flies on from there.
    const releasedAt = React.useRef(0);

    // A change of `index`, from a swipe or from outside, is turned into an
    // animation during render, not in an effect: the card that leaves must
    // still be in the tree when the new index commits, or React unmounts it
    // and there is nothing left to animate.
    const [shownIndex, setShownIndex] = React.useState(index);
    if (index !== shownIndex) {
        setShownIndex(index);
        if (!prefersReducedMotion()) {
            setDeparting({
                index: shownIndex,
                fromX: releasedAt.current,
                direction: index > shownIndex ? 1 : -1,
            });
        }
        releasedAt.current = 0;
    }

    React.useEffect(() => {
        if (!departing) return;
        const timeout = setTimeout(() => setDeparting(null), DURATION_MS);
        return () => clearTimeout(timeout);
    }, [departing]);

    const width = () => rootRef.current?.clientWidth || 1;

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // A tap on the card's own buttons is never the start of a swipe.
        if (
            event.target instanceof Element &&
            event.target.closest("button, a, input, textarea") !== null
        ) {
            return;
        }
        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startTime: event.timeStamp,
            captured: false,
        };
        setDragging(true);
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const moved = event.clientX - current.startX;
        if (!current.captured && Math.abs(moved) >= CAPTURE_AFTER_PX) {
            current.captured = true;
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDx(moved);
    }

    function finish(event: React.PointerEvent<HTMLDivElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        drag.current = null;
        setDragging(false);

        const moved = event.clientX - current.startX;
        const speed = moved / Math.max(event.timeStamp - current.startTime, 1);
        const far = Math.abs(moved) >= width() * SWIPE_SHARE;
        const flick =
            Math.abs(moved) >= FLICK_MIN_PX && Math.abs(speed) >= FLICK_SPEED;

        setDx(0);
        if (!far && !flick) return;
        if (moved > 0 && index < cards.length - 1) {
            releasedAt.current = moved;
            onIndexChange(index + 1);
        } else if (moved < 0 && index > 0) {
            releasedAt.current = moved;
            onIndexChange(index - 1);
        }
    }

    // A drag to the left uncovers the previous card instead of the next ones.
    const goingBack = dx < 0 && index > 0;
    const progress = Math.min(Math.abs(dx) / (width() * SWIPE_SHARE), 1);
    const transition = dragging
        ? "none"
        : `transform ${DURATION_MS}ms ease-out, opacity ${DURATION_MS}ms ease-out`;

    function topStyle(): React.CSSProperties {
        return {
            transform: `translateX(${dx}px) rotate(${(dx / width()) * TILT_DEG}deg)`,
            transition,
        };
    }

    function behindStyle(depth: number): React.CSSProperties {
        // The card right behind grows into place as the top one is dragged
        // away from it, in whichever direction uncovers it.
        const lift = depth === 1 ? progress : 0;
        const level = depth - lift;
        return {
            zIndex: 10 - depth,
            transform: `translateY(${level * 14}px) scale(${1 - level * 0.05})`,
            transition,
        };
    }

    function departingStyle(departure: Departure): React.CSSProperties {
        // On from where the finger let go, a card and a half past the edge.
        const distance = Math.abs(departure.fromX) + width() * 1.5;
        return {
            zIndex: 30,
            transform: `translateX(${departure.direction * distance}px) rotate(${departure.direction * TILT_DEG}deg)`,
            opacity: 0,
            transition: `transform ${DURATION_MS}ms ease-in, opacity ${DURATION_MS}ms ease-in`,
        };
    }

    // One list for every mounted card, the departing one included, so a card
    // keeps its element — and its transition — as its role changes.
    const mounted: Mounted[] = [];
    if (goingBack) {
        mounted.push({ cardIndex: index - 1, role: "behind", depth: 1 });
    } else {
        for (let depth = AHEAD; depth >= 1; depth--) {
            const cardIndex = index + depth;
            if (cardIndex < cards.length) {
                mounted.push({ cardIndex, role: "behind", depth });
            }
        }
    }
    if (index < cards.length) {
        mounted.push({ cardIndex: index, role: "top", depth: 0 });
    }
    if (
        departing &&
        departing.index !== index &&
        departing.index < cards.length
    ) {
        mounted.push({ cardIndex: departing.index, role: "out", depth: -1 });
    }

    return (
        <div
            ref={rootRef}
            data-slot="swipe-card-stack"
            className={cn("relative size-full", className)}
            {...props}
        >
            {mounted.map(({ cardIndex, role, depth }) =>
                role === "top" ? (
                    <div
                        key={cardIndex}
                        data-slot="swipe-card"
                        data-top=""
                        className="absolute inset-0 z-20 cursor-grab touch-none select-none active:cursor-grabbing"
                        style={topStyle()}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={finish}
                        onPointerCancel={finish}
                    >
                        {cards[cardIndex]}
                    </div>
                ) : (
                    <div
                        key={cardIndex}
                        data-slot="swipe-card"
                        aria-hidden
                        inert
                        className="pointer-events-none absolute inset-0"
                        style={
                            role === "out" && departing
                                ? departingStyle(departing)
                                : behindStyle(depth)
                        }
                    >
                        {cards[cardIndex]}
                    </div>
                ),
            )}
        </div>
    );
}

export { SwipeCardStack };
