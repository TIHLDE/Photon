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
            </defs>
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
                            key={i}
                            d={path}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={0.8}
                        />
                    ))}
                </g>
            </g>
        </svg>
    );
}
