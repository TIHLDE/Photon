import { useMediaQuery } from "#/hooks/use-media-query";
import { cn } from "#/lib/utils";
import React from "react";

const lineCount = 32;
const svgWidth = 1440;
const svgHeight = 720;
const svgCenterY = svgHeight / 2;
const waveLoopDistance = (svgWidth * 2) / 3;
const waveDrawEnd = svgWidth + waveLoopDistance;
const waveSegmentWidth = svgWidth / 12;
const formatCoordinate = (value: number) => value.toFixed(1);

// The drawn strip is wider than the hero so it can loop: the scroll layer is
// `waveDrawEnd` units wide and slides left by exactly `waveLoopDistance`, which
// is one wavelength of the pattern, so the frame it lands on is identical to
// the one it started from. Both are expressed as percentages because the
// animation lives in CSS — see `hero-waves-drift` in @tihlde/ui's styles.css.
const scrollLayerWidthPercent = (waveDrawEnd / svgWidth) * 100;
const scrollLoopPercent = (waveLoopDistance / waveDrawEnd) * 100;

// Electric blue: a saturated theme-primary (navy-500) halo around a bright,
// near-white blue core line — reads as a neon/electric glow within the theme.
const pulseGlowColor = "#1B61E4";
const pulseCoreColor = "#9AC2FF";
const pulseBandWidth = 900;
const pulseBandWidthPercent = (pulseBandWidth / svgWidth) * 100;
// The scroll layer nested inside the band, as a percentage of the *band* —
// it still has to come out to `scrollLayerWidthPercent` of the hero itself.
const bandScrollLayerWidthPercent =
    (scrollLayerWidthPercent / pulseBandWidthPercent) * 100;

// Smooth Gaussian falloff for the glow band. Many closely-spaced stops avoid
// the visible slope-change "bands" (Mach banding) that a few stops produce.
const pulseBandMask = `linear-gradient(90deg, ${Array.from(
    { length: 25 },
    (_, i) => {
        const offset = i / 24;
        const opacity = Math.exp(-Math.pow((offset - 0.5) / 0.22, 2));
        return `rgb(0 0 0 / ${opacity.toFixed(3)}) ${(offset * 100).toFixed(1)}%`;
    },
).join(", ")})`;

type WaveConfig = {
    yBase: number;
    amp: number;
    phase: number;
    width: number;
    startX: number;
    endX: number;
};

function sampleWave(x: number, { yBase, amp, phase, width }: WaveConfig) {
    const normalizedX = x / width;
    const primaryPhase = normalizedX * Math.PI * 3 + phase;
    const secondaryPhase = normalizedX * Math.PI * 6 + phase * 1.6;

    return {
        y:
            yBase +
            Math.sin(primaryPhase) * amp * 0.5 +
            Math.sin(secondaryPhase) * amp * 0.3,
        slope:
            Math.cos(primaryPhase) * amp * 0.5 * ((Math.PI * 3) / width) +
            Math.cos(secondaryPhase) * amp * 0.3 * ((Math.PI * 6) / width),
    };
}

function buildWavePath(config: WaveConfig) {
    let current = sampleWave(config.startX, config);
    let path = `M ${formatCoordinate(config.startX)} ${formatCoordinate(current.y)}`;

    for (let x0 = config.startX; x0 < config.endX; x0 += waveSegmentWidth) {
        const x1 = Math.min(x0 + waveSegmentWidth, config.endX);
        const next = sampleWave(x1, config);
        const controlOffset = (x1 - x0) / 3;

        path += ` C ${formatCoordinate(x0 + controlOffset)} ${formatCoordinate(
            current.y + current.slope * controlOffset,
        )} ${formatCoordinate(x1 - controlOffset)} ${formatCoordinate(
            next.y - next.slope * controlOffset,
        )} ${formatCoordinate(x1)} ${formatCoordinate(next.y)}`;

        current = next;
    }

    return path;
}

const wavePaths = Array.from({ length: lineCount }).map((_, i) => {
    const yBase = (i / (lineCount - 1)) * svgHeight;
    const depth = Math.abs(yBase - svgCenterY) / svgCenterY;

    return buildWavePath({
        yBase,
        amp: 22 + (1 - depth) * 38,
        phase: i * 0.22,
        width: svgWidth,
        startX: 0,
        endX: waveDrawEnd,
    });
});

/**
 * One copy of the wave strip. `preserveAspectRatio="none"` stretches it to fill
 * whatever box it is given, so every copy lines up pixel for pixel with the
 * others regardless of the hero's aspect ratio.
 */
function WaveStrip({
    stroke,
    strokeWidth,
    strokeOpacity,
    keyPrefix,
}: {
    stroke: string;
    strokeWidth: number;
    strokeOpacity?: number;
    keyPrefix: string;
}) {
    return (
        <svg
            viewBox={`0 0 ${waveDrawEnd} ${svgHeight}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
        >
            {wavePaths.map((path, i) => (
                <path
                    key={`${keyPrefix}-${i}`}
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                />
            ))}
        </svg>
    );
}

export function HeroSectionBackground({ className }: { className?: string }) {
    // Ingen bevegelse for de som har bedt om det. Pulslaget droppes helt i
    // stedet for bare å stoppes: uten animasjonen ville glødebåndet blitt
    // stående som en statisk stripe midt i bildet.
    const prefersReducedMotion = useMediaQuery(
        "(prefers-reduced-motion: reduce)",
    );

    return (
        <div
            data-slot="hero-waves"
            className={cn(
                "absolute inset-0 h-[90vh] w-full overflow-hidden text-black",
                className,
            )}
            style={
                {
                    "--hero-waves-loop": `${scrollLoopPercent}%`,
                } as React.CSSProperties
            }
            aria-hidden
        >
            <div className="absolute inset-0 opacity-40 dark:opacity-[0.28]">
                <div
                    data-slot="hero-waves-drift"
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${scrollLayerWidthPercent}%` }}
                >
                    <WaveStrip
                        keyPrefix="line"
                        stroke="currentColor"
                        strokeWidth={0.8}
                    />
                </div>
            </div>

            {prefersReducedMotion ? null : (
                <div
                    data-slot="hero-waves-sweep"
                    className="absolute inset-y-0 left-0"
                    style={{
                        width: `${pulseBandWidthPercent}%`,
                        maskImage: pulseBandMask,
                    }}
                >
                    <div
                        data-slot="hero-waves-sweep-counter"
                        className="absolute inset-0"
                    >
                        <div
                            data-slot="hero-waves-drift"
                            className="absolute inset-y-0 left-0"
                            style={{
                                width: `${bandScrollLayerWidthPercent}%`,
                            }}
                        >
                            {/*
                             * Softness comes from a CSS blur on this wrapper,
                             * not an SVG filter. A filter inside the SVG is
                             * re-run every frame the SVG moves; this one is
                             * baked into the layer's raster once and then just
                             * translated with it.
                             */}
                            <div
                                className="absolute inset-0"
                                style={{ filter: "blur(2px)" }}
                            >
                                <WaveStrip
                                    keyPrefix="glow"
                                    stroke={pulseGlowColor}
                                    strokeWidth={7}
                                    strokeOpacity={0.7}
                                />
                            </div>
                            <WaveStrip
                                keyPrefix="beat"
                                stroke={pulseCoreColor}
                                strokeWidth={1.6}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
