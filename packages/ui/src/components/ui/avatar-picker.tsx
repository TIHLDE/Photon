"use client";

import * as React from "react";
import { ImageUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { cn } from "#/lib/utils";

export interface AvatarPickerProps {
    /**
     * Gir tilgang til {@link AvatarPickerHandle}. Heter ikke `ref`, fordi
     * JSX-transformen appen bygges med plukker `ref` ut av props før
     * komponenten ser den.
     */
    controlRef?: React.Ref<AvatarPickerHandle>;
    /** Bildet som vises nå. `null` gir fallbacken. */
    src?: string | null;
    alt?: string;
    /** Vises når det ikke er noe bilde — typisk initialer. */
    fallback?: React.ReactNode;
    onSelect: (file: File | undefined) => void;
    disabled?: boolean;
    labels?: Partial<AvatarPickerLabels>;
    /** Kun størrelse, f.eks. `size-24`. */
    className?: string;
}

export type AvatarPickerLabels = {
    /** Tilgjengelig navn når det allerede finnes et bilde. */
    change: string;
    /** Tilgjengelig navn når det ikke gjør det. */
    upload: string;
    /** Teksten i hover-overlegget. */
    overlay: string;
};

const defaultLabels: AvatarPickerLabels = {
    change: "Bytt bilde",
    upload: "Last opp bilde",
    overlay: "Bytt",
};

export type AvatarPickerHandle = {
    /** Åpner filvelgeren, slik at en knapp ved siden av kan gjøre det samme. */
    open: () => void;
};

/**
 * Rundt bildevelger: selve avataren er knappen.
 *
 * Bildet vises i samme sirkel som det havner i, så velgeren og resultatet er
 * den samme flaten — og fila kan både klikkes fram og slippes rett på bildet.
 * Velgeren beskjærer ikke; den leverer fila videre, typisk til
 * `AvatarCropper`.
 */
export function AvatarPicker({
    controlRef,
    src,
    alt = "",
    fallback,
    onSelect,
    disabled,
    labels: userLabels,
    className,
}: AvatarPickerProps) {
    const labels = { ...defaultLabels, ...userLabels };
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    React.useImperativeHandle(controlRef, () => ({
        open: () => inputRef.current?.click(),
    }));

    return (
        <>
            <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    if (!disabled) onSelect(event.dataTransfer.files[0]);
                }}
                aria-label={src ? labels.change : labels.upload}
                className="group relative shrink-0 rounded-full ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:opacity-50"
            >
                <Avatar
                    className={cn(
                        "size-20",
                        isDragging && "ring-2 ring-primary",
                        !src &&
                            "border-2 border-dashed border-muted-foreground/40",
                        className,
                    )}
                >
                    {src ? <AvatarImage src={src} alt={alt} /> : null}
                    <AvatarFallback className="text-xl">
                        {fallback}
                    </AvatarFallback>
                </Avatar>
                {/* Overlegget ligger over hele sirkelen, men bare synlig ved
                    hover eller tastaturfokus — ellers ville det dekket bildet
                    det er ment å vise fram. */}
                <span
                    aria-hidden
                    className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-xs font-medium text-white transition-opacity",
                        "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                        isDragging && "opacity-100",
                        disabled && "hidden",
                    )}
                >
                    <ImageUp className="size-5" />
                    {labels.overlay}
                </span>
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => {
                    onSelect(event.target.files?.[0]);
                    // Nullstilles slik at samme fil kan velges på nytt etter
                    // en avbrutt beskjæring.
                    event.target.value = "";
                }}
            />
        </>
    );
}
