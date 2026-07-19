"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SignaturePad } from "#/components/ui/signature-pad";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";

/** Handwriting faces available for the typed signature (see styles.css). */
const STYLES = [
    { id: "great-vibes", family: "Great Vibes", label: "Elegant" },
    { id: "dancing-script", family: "Dancing Script", label: "Flytende" },
    { id: "caveat", family: "Caveat", label: "Uformell" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

// Offscreen canvas size. Matches the draw pad so a typed signature and a drawn
// one land at a consistent size once stamped onto the PDF.
const CANVAS_W = 640;
const CANVAS_H = 160;

type SignatureInputProps = {
    /** Signature text — driven by the signer's full-name field. */
    name: string;
    /** Emits a PNG data URL (transparent background) or null when cleared. */
    onChange: (dataUrl: string | null) => void;
    className?: string;
};

/**
 * Signature input with two tabs: "Skriv" renders the signer's name in a
 * handwriting font, "Tegn" lets them draw it by hand. Both emit the same PNG
 * data URL, so the signing pipeline does not care which was used.
 */
export function SignatureInput({
    name,
    onChange,
    className,
}: SignatureInputProps) {
    const [styleId, setStyleId] = useState<StyleId>(STYLES[0].id);
    const [fontsReady, setFontsReady] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Load the handwriting faces once so canvas rendering uses the real glyphs
    // rather than falling back to a default cursive.
    useEffect(() => {
        let active = true;
        void Promise.all(
            STYLES.map((s) => document.fonts.load(`48px '${s.family}'`)),
        )
            .catch(() => undefined)
            .then(() => {
                if (active) setFontsReady(true);
            });
        return () => {
            active = false;
        };
    }, []);

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = CANVAS_W * ratio;
        canvas.height = CANVAS_H * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        const text = name.trim();
        if (!text) {
            onChange(null);
            return;
        }

        const family =
            STYLES.find((s) => s.id === styleId)?.family ?? STYLES[0].family;

        // Shrink until the name fits the canvas width.
        let size = 72;
        const maxWidth = CANVAS_W - 48;
        ctx.fillStyle = "#111111";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        do {
            ctx.font = `${size}px '${family}', cursive`;
            if (ctx.measureText(text).width <= maxWidth || size <= 24) break;
            size -= 2;
        } while (size > 24);

        ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
        onChange(canvas.toDataURL("image/png"));
    }, [name, styleId, onChange]);

    useEffect(() => {
        render();
    }, [render, fontsReady]);

    return (
        <Tabs
            defaultValue="type"
            className={className}
            onValueChange={(value) => {
                // Re-emit the typed signature when coming back from "Tegn",
                // which cleared it.
                if (value === "type") render();
                else onChange(null);
            }}
        >
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="type">Skriv</TabsTrigger>
                <TabsTrigger value="draw">Tegn</TabsTrigger>
            </TabsList>

            <TabsContent value="type" className="mt-2">
                <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setStyleId(s.id)}
                            className={cn(
                                "flex h-16 w-full cursor-pointer flex-col items-center justify-center",
                                "overflow-hidden rounded-md border px-1 transition-colors",
                                // Paper-white regardless of theme: the ink is stamped
                                // onto a white PDF page, so the preview shows it on
                                // the background it will actually land on.
                                "bg-white",
                                styleId === s.id
                                    ? "border-foreground"
                                    : "border-transparent hover:border-muted-foreground",
                            )}
                        >
                            <span
                                className="block w-full truncate text-center text-lg leading-[1.7] text-black"
                                style={{ fontFamily: `'${s.family}', cursive` }}
                            >
                                {name.trim() || "Signatur"}
                            </span>
                            <span className="mt-1 text-[10px] tracking-widest text-neutral-500 uppercase">
                                {s.label}
                            </span>
                        </button>
                    ))}
                </div>
                {/* Offscreen; only used to export the PNG data URL. */}
                <canvas ref={canvasRef} className="hidden" />
            </TabsContent>

            <TabsContent value="draw" className="mt-2">
                <SignaturePad onChange={onChange} />
            </TabsContent>
        </Tabs>
    );
}
