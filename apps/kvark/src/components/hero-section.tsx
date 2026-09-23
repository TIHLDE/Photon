import {
    TILDE_BOX,
    TILDE_PATH,
    TILDE_TRANSFORM,
} from "#/components/icons/tihlde";
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

// Animation fade on top and bottom edges.
const edgeFadeTop = 0.22;
const edgeFadeBottom = 0.82;
const edgeFadeStops = 14;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const edgeFadeRamp = (from: number, to: number) =>
    Array.from({ length: edgeFadeStops }, (_, i) => {
        const t = i / (edgeFadeStops - 1);
        return {
            offset: from + (to - from) * t,
            opacity: smoothstep(t),
        };
    });

const edgeFadeMask = `linear-gradient(to bottom, ${[
    ...edgeFadeRamp(0, edgeFadeTop),
    ...edgeFadeRamp(1, edgeFadeBottom).reverse(),
]
    .map(
        ({ offset, opacity }) =>
            `rgb(0 0 0 / ${opacity.toFixed(3)}) ${(offset * 100).toFixed(1)}%`,
    )
    .join(", ")})`;

// Tilde-en fra logoen står som et dempet felt i bølgene: linjene inne i den er
// svakere enn resten, så formen trer fram som negativt rom idet pulsen skyller
// forbi. `tildeMaskDip` er hvor mye som tas bort — resten av heroen står urørt.
const tildeMaskDip = 0.75;
// Mykner kanten. Blur-en ligger inne i maskebildet — en CSS-blur på laget ville
// også visket ut bølgene. Luften rundt boksen gir blur-en plass å tone ut i.
const tildeMaskBlur = 4;
const tildeMaskPadding = 32;
// Feter opp selve båndet uten å gjøre formen bredere på skjermen: strek langs
// samme kurve legger halve bredden utenpå omrisset hele veien rundt. viewBox-en
// står stille, så tilde-en dekker like mye bredde som før — bare tykkere.
const tildeMaskThickness = 24;

const tildeMaskSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${TILDE_BOX.x - tildeMaskPadding} ${TILDE_BOX.y - tildeMaskPadding} ${TILDE_BOX.width + tildeMaskPadding * 2} ${TILDE_BOX.height + tildeMaskPadding * 2}">`,
    `<filter id="soften" x="-25%" y="-50%" width="150%" height="200%">`,
    `<feGaussianBlur stdDeviation="${tildeMaskBlur}"/>`,
    `</filter>`,
    // Dempingen ligger på gruppa, ikke på strek og fyll hver for seg — ellers
    // ville overlappet mellom dem lagt seg opp til en mørkere kant.
    `<g opacity="${tildeMaskDip}" filter="url(#soften)">`,
    `<path d="${TILDE_PATH}" transform="${TILDE_TRANSFORM}" fill="black" stroke="black" stroke-width="${tildeMaskThickness}" stroke-linejoin="round"/>`,
    `</g>`,
    `</svg>`,
].join("");

// Bredere enn heroen, så formen blir stor nok til å leses: de tynne spissene
// går ut over kanten, mens selve svingen ligger godt innenfor.
const tildeMaskWidthPercent = 130;

// Kantfallet ligger øverst og trekker tilde-laget fra seg selv, så masken er
// full i midten, toner ut mot topp og bunn, og er dempet der tilde-en ligger.
// Hele masken bygges her, inline: `mask-image` i stilarket blir uansett
// overstyrt av `style`-attributtet, så to halve masker kan ikke leve side om
// side — den ene ville stilltiende bli borte.
//
// Tilde-en får beholde sitt eget sideforhold (`auto` leser høyden ut av
// viewBox-en) i stedet for å strekkes med heroen slik bølgene gjør — strukket
// over en høy mobilskjerm ble den bare en diagonal klatt.
const heroMaskLayers = {
    maskImage: `${edgeFadeMask}, url("data:image/svg+xml,${encodeURIComponent(tildeMaskSvg)}")`,
    maskSize: `100% 100%, ${tildeMaskWidthPercent}% auto`,
    maskPosition: "center, center",
    maskRepeat: "no-repeat, no-repeat",
    maskComposite: "subtract, add",
} as const;

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
    return (
        <div
            data-slot="hero-waves"
            className={cn(
                // Høyden kommer fra `inset-0` alene. En egen høyde her var
                // 90vh, som er høyere enn seksjonene på /opptak, /ny-student
                // og /bedrift — bølgene ble kappet tvert av `overflow-hidden`
                // i bunnen i stedet for å fylle seksjonen.
                "absolute inset-0 overflow-hidden text-black",
                className,
            )}
            style={
                {
                    "--hero-waves-loop": `${scrollLoopPercent}%`,
                    ...heroMaskLayers,
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
        </div>
    );
}
