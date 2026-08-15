"use client";

import { Loader2, PenLine } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

// react-pdf ships its own pdfjs; the worker must come from the same version or
// it refuses to render. Resolved from the package rather than a CDN so the app
// keeps working offline and behind a CSP.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString();

/**
 * Where an element sits on a page, normalized to 0..1 of that page's size with
 * a top-left origin. The API stores this shape verbatim and flips y at stamping
 * time, since pdf-lib measures from the bottom.
 */
export type Placement = {
    page: number;
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
};

export type PlacementFields = {
    signature: Placement | null;
    name: Placement | null;
};

type FieldKey = keyof PlacementFields;

type Slot = {
    key: FieldKey;
    label: string;
    /** Default box size as a fraction of the page. */
    w: number;
    h: number;
    /**
     * Which part of the box follows the pointer, matching where the API draws
     * the field inside it: the signature rests on the box's bottom edge, the
     * name line is centred. Dropping a bottom-anchored box centred on the
     * cursor put the ink half a box height — some 12 mm — below the line the
     * admin aimed at, which is how the 2026 contract ended up signed across
     * its own signature line instead of on it.
     */
    anchor: "bottom" | "center";
};

const SLOTS: Slot[] = [
    { key: "signature", label: "Signatur", w: 0.28, h: 0.08, anchor: "bottom" },
    {
        key: "name",
        label: "Navn og dato",
        w: 0.26,
        h: 0.022,
        anchor: "center",
    },
];

/** Box top for a pointer at `atPct`, given the box's height and anchor. */
function topForPointer(atPct: number, hPct: number, anchor: Slot["anchor"]) {
    return atPct - (anchor === "bottom" ? hPct : hPct / 2);
}

const SLOT_BY_KEY = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<
    FieldKey,
    Slot
>;

const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

type PdfPlacementProps = {
    /** URL of the PDF to place fields on. */
    fileUrl: string;
    /** Rendered page width in CSS pixels. */
    width?: number;
    fields: PlacementFields;
    onChange: (fields: PlacementFields) => void;
    className?: string;
};

/**
 * Renders every page of a contract PDF and lets an admin drop the signature and
 * name fields onto it, then drag them to fine-tune.
 *
 * Browser-only: react-pdf needs canvas and a worker, so mount this behind a
 * client-only boundary.
 */
export function PdfPlacement({
    fileUrl,
    width = 720,
    fields,
    onChange,
    className,
}: PdfPlacementProps) {
    const [numPages, setNumPages] = useState(0);
    const [heights, setHeights] = useState<Record<number, number>>({});
    const [placing, setPlacing] = useState<FieldKey | null>(null);
    const dragRef = useRef<{ key: FieldKey; page: number } | null>(null);

    const setField = useCallback(
        (key: FieldKey, placement: Placement | null) => {
            onChange({ ...fields, [key]: placement });
        },
        [fields, onChange],
    );

    /**
     * Click a page while a slot is armed to drop it. Horizontally the box is
     * centred on the cursor; vertically the cursor lands on whichever edge the
     * field is drawn from, so clicking a signature line puts the signature on
     * it.
     */
    function onPageClick(e: React.MouseEvent, pageIndex: number) {
        if (!placing) return;
        const { w, h, anchor } = SLOT_BY_KEY[placing];
        const rect = e.currentTarget.getBoundingClientRect();
        const xPct = clamp(
            (e.clientX - rect.left) / rect.width - w / 2,
            0,
            1 - w,
        );
        const yPct = clamp(
            topForPointer((e.clientY - rect.top) / rect.height, h, anchor),
            0,
            1 - h,
        );
        setField(placing, { page: pageIndex, xPct, yPct, wPct: w, hPct: h });
        setPlacing(null);
    }

    function onMarkerPointerDown(
        e: React.PointerEvent,
        key: FieldKey,
        page: number,
    ) {
        e.stopPropagation();
        e.preventDefault();
        dragRef.current = { key, page };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    }

    function onPagePointerMove(e: React.PointerEvent) {
        const drag = dragRef.current;
        if (!drag) return;
        const placement = fields[drag.key];
        if (placement?.page !== drag.page) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setField(drag.key, {
            ...placement,
            xPct: clamp(
                (e.clientX - rect.left) / rect.width - placement.wPct / 2,
                0,
                1 - placement.wPct,
            ),
            yPct: clamp(
                topForPointer(
                    (e.clientY - rect.top) / rect.height,
                    placement.hPct,
                    SLOT_BY_KEY[drag.key].anchor,
                ),
                0,
                1 - placement.hPct,
            ),
        });
    }

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="bg-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border p-2">
                <span className="text-muted-foreground text-xs">
                    {placing
                        ? `Klikk i dokumentet for å plassere «${SLOT_BY_KEY[placing].label}»`
                        : "Plasser feltene på dokumentet. Klikk rett på signaturlinja — signaturen står på den heltrukne kanten av boksen. Navn og dato er valgfritt."}
                </span>
                {SLOTS.map((slot) => (
                    <Button
                        key={slot.key}
                        type="button"
                        size="sm"
                        variant={placing === slot.key ? "default" : "outline"}
                        onClick={() =>
                            setPlacing(placing === slot.key ? null : slot.key)
                        }
                    >
                        <PenLine className="mr-1.5 size-3.5" />
                        {slot.label}
                        {fields[slot.key] ? " ✓" : ""}
                    </Button>
                ))}
                {(fields.signature || fields.name) && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            onChange({ signature: null, name: null })
                        }
                    >
                        Nullstill
                    </Button>
                )}
            </div>

            <div className="flex flex-col items-center">
                <Document
                    file={fileUrl}
                    loading={
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="text-muted-foreground size-6 animate-spin" />
                        </div>
                    }
                    error={
                        <p className="text-muted-foreground py-20 text-sm">
                            Kunne ikke laste PDF-en.
                        </p>
                    }
                    onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                >
                    {Array.from({ length: numPages }, (_, i) => {
                        const pageHeight = heights[i];
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "relative mb-3 border shadow-sm",
                                    placing && "cursor-crosshair",
                                )}
                                onClick={(e) => onPageClick(e, i)}
                                onPointerMove={onPagePointerMove}
                                onPointerUp={() => {
                                    dragRef.current = null;
                                }}
                                style={{ width }}
                            >
                                <Page
                                    pageNumber={i + 1}
                                    width={width}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    onLoadSuccess={(page) =>
                                        setHeights((prev) => ({
                                            ...prev,
                                            [i]:
                                                (width * page.height) /
                                                page.width,
                                        }))
                                    }
                                />
                                {pageHeight != null &&
                                    SLOTS.map((slot) => {
                                        const p = fields[slot.key];
                                        if (p?.page !== i) return null;
                                        return (
                                            <div
                                                key={slot.key}
                                                onPointerDown={(e) =>
                                                    onMarkerPointerDown(
                                                        e,
                                                        slot.key,
                                                        i,
                                                    )
                                                }
                                                className={cn(
                                                    "absolute flex cursor-move items-center justify-center rounded-sm",
                                                    "border-2 border-dashed border-primary bg-primary/20",
                                                    "text-[10px] font-medium tracking-widest uppercase text-primary",
                                                )}
                                                style={{
                                                    left: p.xPct * width,
                                                    top: p.yPct * pageHeight,
                                                    width: p.wPct * width,
                                                    height: p.hPct * pageHeight,
                                                    // The edge the ink rests on
                                                    // is drawn solid, so it is
                                                    // visible which part of the
                                                    // box has to meet the line.
                                                    ...(slot.anchor === "bottom"
                                                        ? {
                                                              borderBottomStyle:
                                                                  "solid",
                                                          }
                                                        : null),
                                                }}
                                            >
                                                {slot.label}
                                            </div>
                                        );
                                    })}
                            </div>
                        );
                    })}
                </Document>
            </div>
        </div>
    );
}
