"use client";

import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type SignaturePadProps = {
    /** Emits a PNG data URL on each stroke end, or null when cleared. */
    onChange: (dataUrl: string | null) => void;
    className?: string;
};

/**
 * Free-draw signature canvas. The browser produces the PNG; the server only
 * embeds it, so no DOM is needed server-side.
 */
export function SignaturePad({ onChange, className }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasInk = useRef(false);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Ink stays near-black in both themes: the PNG is stamped onto a white
        // PDF page, so it must not follow the app's foreground colour.
        ctx.strokeStyle = "#111111";
    }, []);

    function positionOf(e: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        drawing.current = true;
        canvasRef.current?.setPointerCapture(e.pointerId);
        const { x, y } = positionOf(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawing.current) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = positionOf(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        hasInk.current = true;
    }

    function end() {
        if (!drawing.current) return;
        drawing.current = false;
        if (hasInk.current && canvasRef.current) {
            setEmpty(false);
            onChange(canvasRef.current.toDataURL("image/png"));
        }
    }

    function clear() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk.current = false;
        setEmpty(true);
        onChange(null);
    }

    return (
        <div className={className}>
            {/* Paper-white in both themes: the ink is near-black because it gets
                stamped onto a white PDF page, so a themed surface would hide it. */}
            <div className="relative rounded-md border bg-white">
                <canvas
                    ref={canvasRef}
                    className="h-40 w-full touch-none rounded-md"
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerLeave={end}
                />
                {empty && (
                    <span
                        className={cn(
                            "pointer-events-none absolute inset-0",
                            "flex items-center justify-center text-xs text-neutral-500",
                        )}
                    >
                        Tegn signaturen din her
                    </span>
                )}
            </div>
            <div className="mt-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={clear}>
                    <Eraser className="mr-1.5 size-3.5" /> Tøm
                </Button>
            </div>
        </div>
    );
}
