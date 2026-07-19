import { cn } from "#/lib/utils";
import React from "react";

const lineCount = 32;
const svgWidth = 1440;
const svgHeight = 720;
const svgCenterX = svgWidth / 2;
const svgCenterY = svgHeight / 2;
const waveLoopDistance = (svgWidth * 2) / 3;
const waveDrawEnd = svgWidth + waveLoopDistance;
const waveSegmentWidth = svgWidth / 12;
const contentFadeXRadius = svgWidth * 0.42;
const contentFadeYRadius = svgHeight * 0.42;
const scrollDurationSeconds = 24;
const formatCoordinate = (value: number) => value.toFixed(1);

// Heartbeat pulse: a light-blue highlight sweeps across the waves in ~2s,
// then rests until the next beat — an 8s cycle (2s / 8s = 0.25 keyTime).
// Electric blue: a saturated theme-primary (navy-500) halo around a bright,
// near-white blue core line — reads as a neon/electric glow within the theme.
const pulseGlowColor = "#1B61E4";
const pulseCoreColor = "#9AC2FF";
const pulseCycleSeconds = 14;
const pulseBandWidth = 900;
// Slow, smooth right-to-left glide (Stripe-like): one soft glow drifts across
// over ~8s with gentle ease-in-out, then rests off-screen until the next pass.
const pulseKeyTimes = "0;0.57;1";
const pulseValues = [
    `${svgWidth} 0`,
    `-${pulseBandWidth} 0`,
    `-${pulseBandWidth} 0`,
].join(";");
const pulseKeySplines = "0.42 0 0.58 1;0 0 1 1";
// Smooth Gaussian falloff for the glow band. Many closely-spaced stops avoid
// the visible slope-change "bands" (Mach banding) that a few stops produce.
const pulseStops = Array.from({ length: 25 }, (_, i) => {
    const offset = i / 24;
    const opacity = Math.exp(-Math.pow((offset - 0.5) / 0.22, 2));
    return { offset, opacity };
});

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

export function HeroSectionBackground({ className }: { className?: string }) {
    const fadeId = React.useId().replace(/:/g, "");
    const vignetteGradientId = `${fadeId}-vignette-gradient`;
    const contentFadeGradientId = `${fadeId}-content-fade-gradient`;
    const vignetteMaskId = `${fadeId}-vignette-mask`;
    const pulseGradientId = `${fadeId}-pulse-gradient`;
    const pulseMaskId = `${fadeId}-pulse-mask`;
    const pulseGlowId = `${fadeId}-pulse-glow`;

    const paths = React.useMemo(
        () =>
            Array.from({ length: lineCount }).map((_, i) => {
                const yBase = (i / (lineCount - 1)) * svgHeight;
                const depth = Math.abs(yBase - svgCenterY) / svgCenterY;
                const amp = 22 + (1 - depth) * 38;

                return buildWavePath({
                    yBase,
                    amp,
                    phase: i * 0.22,
                    width: svgWidth,
                    startX: 0,
                    endX: waveDrawEnd,
                });
            }),
        [],
    );

    return (
        <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            className={cn(
                "absolute inset-0 w-full h-[90vh] text-black",
                className,
            )}
        >
            <defs>
                <radialGradient
                    id={vignetteGradientId}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientTransform={`translate(${svgCenterX} ${svgCenterY}) scale(${svgWidth * 1.2} ${svgHeight * 0.5})`}
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                    <stop offset="50%" stopColor="white" stopOpacity="1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                    id={contentFadeGradientId}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientTransform={`translate(${svgCenterX} ${svgCenterY}) scale(${contentFadeXRadius} ${contentFadeYRadius})`}
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="black" stopOpacity="0.92" />
                    <stop offset="58%" stopColor="black" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="black" stopOpacity="0" />
                </radialGradient>
                <mask
                    id={vignetteMaskId}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width={svgWidth}
                    height={svgHeight}
                >
                    <rect
                        width={svgWidth}
                        height={svgHeight}
                        fill={`url(#${vignetteGradientId})`}
                    />
                    <rect
                        width={svgWidth}
                        height={svgHeight}
                        fill={`url(#${contentFadeGradientId})`}
                    />
                </mask>
                <linearGradient
                    id={pulseGradientId}
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1="0"
                    x2={pulseBandWidth}
                    y2="0"
                >
                    {pulseStops.map((stop) => (
                        <stop
                            key={stop.offset}
                            offset={stop.offset}
                            stopColor="white"
                            stopOpacity={stop.opacity}
                        />
                    ))}
                    <animateTransform
                        attributeName="gradientTransform"
                        type="translate"
                        dur={`${pulseCycleSeconds}s`}
                        keyTimes={pulseKeyTimes}
                        keySplines={pulseKeySplines}
                        calcMode="spline"
                        values={pulseValues}
                        repeatCount="indefinite"
                    />
                </linearGradient>
                <mask
                    id={pulseMaskId}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width={svgWidth}
                    height={svgHeight}
                >
                    <rect
                        width={svgWidth}
                        height={svgHeight}
                        fill={`url(#${pulseGradientId})`}
                    />
                </mask>
                <filter
                    id={pulseGlowId}
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                >
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            <g
                className="opacity-40 dark:opacity-[0.28]"
                mask={`url(#${vignetteMaskId})`}
            >
                <g>
                    <animateTransform
                        attributeName="transform"
                        dur={`${scrollDurationSeconds}s`}
                        from="0 0"
                        repeatCount="indefinite"
                        to={`-${waveLoopDistance} 0`}
                        type="translate"
                    />
                    {paths.map((path, i) => (
                        <path
                            key={i}
                            d={path}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={0.8}
                        />
                    ))}
                </g>
            </g>
            <g mask={`url(#${pulseMaskId})`}>
                <g mask={`url(#${vignetteMaskId})`}>
                    <g>
                        <animateTransform
                            attributeName="transform"
                            dur={`${scrollDurationSeconds}s`}
                            from="0 0"
                            repeatCount="indefinite"
                            to={`-${waveLoopDistance} 0`}
                            type="translate"
                        />
                        {paths.map((path, i) => (
                            <path
                                key={`glow-${i}`}
                                d={path}
                                fill="none"
                                stroke={pulseGlowColor}
                                strokeWidth={7}
                                strokeOpacity={0.7}
                                filter={`url(#${pulseGlowId})`}
                            />
                        ))}
                        {paths.map((path, i) => (
                            <path
                                key={`beat-${i}`}
                                d={path}
                                fill="none"
                                stroke={pulseCoreColor}
                                strokeWidth={1.6}
                            />
                        ))}
                    </g>
                </g>
            </g>
        </svg>
    );
}
