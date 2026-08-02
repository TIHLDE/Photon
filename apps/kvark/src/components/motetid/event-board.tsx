import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Label } from "@tihlde/ui/ui/label";
import {
    MotetidCalendarOverlayBlock,
    MotetidCell,
    MotetidGridHeadCell,
    MotetidHeatLegend,
    MotetidModeToggle,
    MotetidTimeCell,
    type MotetidCellProps,
} from "@tihlde/ui/ui/motetid-grid";
import { Switch } from "@tihlde/ui/ui/switch";

import {
    areSelectionsEqual,
    buildTimeSlots,
    type DateMode,
    type DragAction,
    type FillMode,
    getCellVisual,
    getSlotKeysInRange,
    resolveDragAction,
    type SlotStatus,
    slotIndicesOverlappingEventOnDate,
    weekdayLabel,
} from "#/lib/motetid-grid";

const calendarBoardCacheKey = (eventSlug: string) =>
    `calendarGhost:${eventSlug}`;

export type SyncCalendarEvent = {
    title: string;
    start: string;
    end: string;
};

type CalendarBoardCache = {
    blocked: string[];
    events: SyncCalendarEvent[];
    syncedAt: number;
};

export type MotetidParticipantSeed = {
    id: string;
    name: string;
    userId: string | null;
    slots: { date: string; time: string; status: SlotStatus }[];
};

export type SyncCalendarResult =
    | { ok: true; blocked: string[]; events: SyncCalendarEvent[] }
    | { ok: false; requiresReconnect: boolean; error: string };

type EventBoardProps = {
    slug: string;
    shareUrl: string;
    /** Whether `dates` holds calendar dates or weekday keys. */
    dateMode: DateMode;
    dates: string[];
    startTime: string;
    endTime: string;
    slotDuration: number;
    deadline?: string | null;
    viewer: {
        isAuthenticated: boolean;
        participantId: string | null;
        name: string | null;
    };
    participants: MotetidParticipantSeed[];
    /** Persist the viewer's full slot selection. */
    onSave: (
        slots: { date: string; time: string; status: SlotStatus }[],
    ) => Promise<{ participantId: string }>;
    /** Fetch Google Calendar busy blocks for this event. */
    onSyncCalendar: () => Promise<SyncCalendarResult>;
    /** Start the Google OAuth connect flow, returning to `returnTo` after. */
    onConnectCalendar: (returnTo: string) => Promise<void>;
};

type CellVisualVariant = NonNullable<MotetidCellProps["visual"]>;

export function MotetidEventBoard({
    slug,
    shareUrl,
    dateMode,
    dates,
    startTime,
    endTime,
    slotDuration,
    deadline,
    viewer,
    participants,
    onSave,
    onSyncCalendar,
    onConnectCalendar,
}: EventBoardProps) {
    const [participantId, setParticipantId] = useState<string | undefined>();
    const [saved, setSaved] = useState(false);
    const [fillMode, setFillMode] = useState<FillMode>("AVAILABLE");
    const [isEditing, setIsEditing] = useState(false);
    const [selected, setSelected] = useState<Record<string, SlotStatus>>({});
    const [persistedSelected, setPersistedSelected] = useState<
        Record<string, SlotStatus>
    >({});
    const [calendarUnavailable, setCalendarUnavailable] = useState<
        Record<string, boolean>
    >({});
    const [calendarEvents, setCalendarEvents] = useState<SyncCalendarEvent[]>(
        [],
    );
    const [paintedSlots, setPaintedSlots] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(0);
    const [copied, setCopied] = useState(false);
    const [fillingWave, setFillingWave] = useState(false);
    /** Increment to restart the primary-button nudge animation. */
    const [primaryBlinkNonce, setPrimaryBlinkNonce] = useState(0);
    const [hoveredParticipantId, setHoveredParticipantId] = useState<
        string | null
    >(null);
    const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
    const [narrowGrid, setNarrowGrid] = useState(false);
    const [daysPerPage, setDaysPerPage] = useState(7);
    const [countIfNeeded, setCountIfNeeded] = useState(true);

    const displayName = viewer.name?.trim() ?? "";
    const isWeekdayMode = dateMode === "WEEKDAYS";

    const isDraggingRef = useRef(false);
    const gridScrollRef = useRef<HTMLDivElement | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const paintedSlotsRef = useRef<Set<string>>(new Set());
    const lastPaintedRef = useRef<{ date: string; time: string } | null>(null);
    const dragActionRef = useRef<DragAction | null>(null);
    const fillModeRef = useRef<FillMode>(fillMode);
    const isEditingRef = useRef(isEditing);
    const selectedRef = useRef(selected);
    useEffect(() => {
        fillModeRef.current = fillMode;
    }, [fillMode]);
    useEffect(() => {
        isEditingRef.current = isEditing;
    }, [isEditing]);
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    const readOnly = Boolean(deadline && new Date() > new Date(deadline));
    const canParticipate = Boolean(viewer.isAuthenticated && displayName);
    const othersHaveSlots = participants.some((p) => p.slots.length > 0);
    const showHeatmap = saved || (!canParticipate && othersHaveSlots);
    const heatmapView = showHeatmap && !isEditing;
    const hasUnsavedChanges = !areSelectionsEqual(selected, persistedSelected);
    const slots = useMemo(
        () => buildTimeSlots(startTime, endTime, slotDuration),
        [startTime, endTime, slotDuration],
    );
    const timeColWidth = narrowGrid ? 44 : 56;
    const rowHeight = narrowGrid ? 44 : 32;
    const headerRowHeight = narrowGrid ? 48 : 40;
    const pages = Math.max(1, Math.ceil(dates.length / daysPerPage));
    const visibleDates = dates.slice(
        page * daysPerPage,
        page * daysPerPage + daysPerPage,
    );

    const calendarOverlayPlacements = useMemo(() => {
        if (calendarEvents.length === 0) return [];
        type Placement = {
            key: string;
            dateCol: number;
            rowStart: number;
            rowEnd: number;
            title: string;
        };
        const raw: Placement[] = [];
        for (const ev of calendarEvents) {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);
            if (
                Number.isNaN(evStart.getTime()) ||
                Number.isNaN(evEnd.getTime())
            ) {
                continue;
            }
            for (let d = 0; d < visibleDates.length; d++) {
                const dateStr = visibleDates[d]!;
                const idx = slotIndicesOverlappingEventOnDate(
                    dateStr,
                    evStart,
                    evEnd,
                    slots,
                    slotDuration,
                );
                if (!idx) continue;
                raw.push({
                    key: `${ev.start}|${ev.end}|${dateStr}|${d}`,
                    dateCol: d,
                    rowStart: idx.startIdx + 2,
                    rowEnd: idx.endIdxExclusive + 2,
                    title: ev.title,
                });
            }
        }

        const byCol = new Map<number, Placement[]>();
        for (const p of raw) {
            const list = byCol.get(p.dateCol) ?? [];
            list.push(p);
            byCol.set(p.dateCol, list);
        }

        const result: (Placement & { layer: number; zIndex: number })[] = [];
        for (const [, list] of byCol) {
            const sorted = [...list].sort((a, b) => a.rowStart - b.rowStart);
            const layers: number[] = [];
            for (let i = 0; i < sorted.length; i++) {
                let layer = 0;
                for (let j = 0; j < i; j++) {
                    const overlaps =
                        sorted[i]!.rowStart < sorted[j]!.rowEnd &&
                        sorted[j]!.rowStart < sorted[i]!.rowEnd;
                    if (overlaps) {
                        layer = Math.max(layer, layers[j]! + 1);
                    }
                }
                layers[i] = layer;
                result.push({
                    ...sorted[i]!,
                    layer,
                    zIndex: 10 + layer,
                });
            }
        }
        return result;
    }, [calendarEvents, visibleDates, slots, slotDuration]);

    useEffect(() => {
        if (!viewer.isAuthenticated) return;
        try {
            const raw = sessionStorage.getItem(calendarBoardCacheKey(slug));
            if (!raw) return;
            const parsed = JSON.parse(raw) as CalendarBoardCache;
            if (!Array.isArray(parsed.blocked) || !Array.isArray(parsed.events))
                return;
            setCalendarUnavailable(
                Object.fromEntries(
                    parsed.blocked.map((k) => [k, true] as const),
                ),
            );
            setCalendarEvents(parsed.events);
        } catch {
            /* ignore corrupt cache */
        }
    }, [slug, viewer.isAuthenticated]);

    useEffect(() => {
        const picked = viewer.participantId
            ? participants.find((p) => p.id === viewer.participantId)
            : undefined;
        if (!picked) return;
        setParticipantId(picked.id);
        setSaved(true);
        setIsEditing(false);
        const pickedSelected = Object.fromEntries(
            picked.slots.map((slot) => [
                `${slot.date}|${slot.time}`,
                slot.status,
            ]),
        );
        setSelected(pickedSelected);
        setPersistedSelected(pickedSelected);
    }, [participants, viewer.participantId]);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)");
        const apply = () => setNarrowGrid(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    // Fit the number of visible day columns to the available width so the grid
    // never needs horizontal scrolling on small screens.
    useEffect(() => {
        const el = gridScrollRef.current;
        if (!el) return;
        const MIN_COL = 64;
        const compute = () => {
            const width = el.clientWidth;
            if (width <= 0) return;
            const tcw = window.matchMedia("(max-width: 640px)").matches
                ? 44
                : 56;
            const fit = Math.floor((width - tcw) / MIN_COL);
            setDaysPerPage(Math.max(1, Math.min(fit, 7, dates.length)));
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [dates.length]);

    // Keep the current page in range when the days-per-page count changes.
    useEffect(() => {
        setPage((p) => Math.min(p, pages - 1));
    }, [pages]);

    const commitPaintDrag = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const action = dragActionRef.current;
        dragActionRef.current = null;
        const toPaint = new Set(paintedSlotsRef.current);
        paintedSlotsRef.current = new Set();
        lastPaintedRef.current = null;

        if (!action || toPaint.size === 0) {
            setPaintedSlots(new Set());
            return;
        }

        setSelected((prev) => {
            const next = { ...prev };
            for (const key of toPaint) {
                if (action === "remove") {
                    delete next[key];
                } else if (action === "add_available") {
                    next[key] = "AVAILABLE";
                } else {
                    next[key] = "IF_NEEDED";
                }
            }
            return next;
        });

        setPaintedSlots(new Set());
    }, []);

    useEffect(() => {
        const onPointerEnd = () => {
            commitPaintDrag();
        };
        document.addEventListener("pointerup", onPointerEnd);
        document.addEventListener("pointercancel", onPointerEnd);
        return () => {
            document.removeEventListener("pointerup", onPointerEnd);
            document.removeEventListener("pointercancel", onPointerEnd);
        };
    }, [commitPaintDrag]);

    const peopleByCell = useMemo(() => {
        const map: Record<string, { name: string; status: SlotStatus }[]> = {};
        for (const participant of participants) {
            for (const slot of participant.slots) {
                const key = `${slot.date}|${slot.time}`;
                map[key] ??= [];
                map[key].push({ name: participant.name, status: slot.status });
            }
        }
        if (displayName) {
            for (const [key, status] of Object.entries(selected)) {
                map[key] = [
                    ...(map[key] ?? []).filter((r) => r.name !== displayName),
                    { name: displayName, status },
                ];
            }
        }
        return map;
    }, [participants, selected, displayName]);

    const participantsWithAvailability = useMemo(
        () =>
            [...participants]
                .filter((p) => p.slots.length > 0)
                .sort((a, b) => a.name.localeCompare(b.name, "nb")),
        [participants],
    );

    const hoveredSlots = useMemo(() => {
        if (!hoveredParticipantId) return null;
        const p = participants.find((x) => x.id === hoveredParticipantId);
        if (!p) return null;
        const map: Record<string, SlotStatus> = Object.fromEntries(
            p.slots.map((slot) => [`${slot.date}|${slot.time}`, slot.status]),
        );
        if (participantId && hoveredParticipantId === participantId) {
            for (const [key, status] of Object.entries(selected)) {
                map[key] = status;
            }
        }
        return map;
    }, [hoveredParticipantId, participants, participantId, selected]);

    const availableAtHoveredSlot = useMemo(() => {
        if (!hoveredSlotKey) return null;
        const ids = new Set<string>();
        for (const p of participants) {
            if (p.slots.some((s) => `${s.date}|${s.time}` === hoveredSlotKey)) {
                ids.add(p.id);
            }
        }
        // Reflect the current user's own (possibly unsaved) selection.
        if (participantId) {
            if (selected[hoveredSlotKey]) ids.add(participantId);
            else ids.delete(participantId);
        }
        return ids;
    }, [hoveredSlotKey, participants, participantId, selected]);

    const slotCount = useCallback(
        (key: string) => {
            const list = peopleByCell[key] ?? [];
            const available = list.filter(
                (e) => e.status === "AVAILABLE",
            ).length;
            const ifNeeded = list.filter(
                (e) => e.status === "IF_NEEDED",
            ).length;
            return available + (countIfNeeded ? ifNeeded : 0);
        },
        [peopleByCell, countIfNeeded],
    );

    const heatmapMaxCount = useMemo(() => {
        let max = 0;
        for (const date of visibleDates) {
            for (const time of slots) {
                max = Math.max(max, slotCount(`${date}|${time}`));
            }
        }
        return max;
    }, [visibleDates, slots, slotCount]);

    function getHeatmapVisual(key: string): CellVisualVariant {
        const count = slotCount(key);
        if (count === 0) return "heat-0";
        const ratio = heatmapMaxCount > 0 ? count / heatmapMaxCount : 0;
        if (ratio >= 1) return "heat-6";
        if (ratio >= 0.8) return "heat-5";
        if (ratio >= 0.6) return "heat-4";
        if (ratio >= 0.4) return "heat-3";
        if (ratio >= 0.2) return "heat-2";
        return "heat-1";
    }

    function paintVisual(): CellVisualVariant {
        const action = dragActionRef.current;
        if (!action) return "empty";
        if (action === "remove") return "paintRemove";
        if (action === "add_available") return "paintAvailable";
        return "paintIfNeeded";
    }

    function cellVisual(args: {
        key: string;
        mine: SlotStatus | undefined;
        isPainted: boolean;
        hoverActive: boolean;
        hoveredStatus: SlotStatus | undefined;
    }): CellVisualVariant {
        const { key, mine, isPainted, hoverActive, hoveredStatus } = args;
        if (isPainted) return paintVisual();

        if (hoverActive) {
            if (hoveredStatus === "AVAILABLE") return "available";
            if (hoveredStatus === "IF_NEEDED") return "ifNeeded";
            return "empty";
        }

        // In read/heatmap mode the aggregate gradient wins over the viewer's
        // own selection — your slots still count toward the totals, they just
        // aren't over-painted with a flat colour that hides what suits the
        // most people.
        if (heatmapView) return getHeatmapVisual(key);

        if (mine === "AVAILABLE") return "available";
        if (mine === "IF_NEEDED") return "ifNeeded";

        if (isEditing) return "editingEmpty";

        return "empty";
    }

    function triggerPrimaryBlink() {
        setPrimaryBlinkNonce((n) => n + 1);
    }

    function handleCellMouseDown(date: string, time: string) {
        if (readOnly || !canParticipate) return;
        const key = `${date}|${time}`;
        if (!isEditingRef.current) {
            triggerPrimaryBlink();
            return;
        }

        const visual = getCellVisual(
            key,
            selectedRef.current,
            isEditingRef.current,
        );
        const action = resolveDragAction(fillModeRef.current, visual);
        if (!action) return;

        dragActionRef.current = action;
        isDraggingRef.current = true;
        paintedSlotsRef.current = new Set([key]);
        setPaintedSlots(new Set([key]));
        lastPaintedRef.current = { date, time };
    }

    const applyPaintRange = useCallback(
        (date: string, time: string) => {
            if (!isDraggingRef.current || !dragActionRef.current) return;
            const last = lastPaintedRef.current;
            const keys = last
                ? getSlotKeysInRange(
                      last.date,
                      last.time,
                      date,
                      time,
                      visibleDates,
                      slots,
                  )
                : [`${date}|${time}`];
            const nextPainted = new Set(paintedSlotsRef.current);
            for (const k of keys) nextPainted.add(k);
            paintedSlotsRef.current = nextPainted;
            setPaintedSlots((prev) => {
                const next = new Set(prev);
                for (const k of keys) next.add(k);
                return next;
            });
            lastPaintedRef.current = { date, time };
        },
        [visibleDates, slots],
    );

    useEffect(() => {
        const onPointerMove = (ev: PointerEvent) => {
            if (!isDraggingRef.current || !dragActionRef.current) return;
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const btn = el?.closest(
                "[data-slot-key]",
            ) as HTMLButtonElement | null;
            const slotKey = btn?.dataset.slotKey;
            if (!slotKey) return;
            const i = slotKey.indexOf("|");
            if (i === -1) return;
            applyPaintRange(slotKey.slice(0, i), slotKey.slice(i + 1));
        };
        document.addEventListener("pointermove", onPointerMove);
        return () => document.removeEventListener("pointermove", onPointerMove);
    }, [applyPaintRange]);

    function handleCellMouseEnter(date: string, time: string) {
        applyPaintRange(date, time);
        if (!isEditingRef.current) {
            setHoveredSlotKey(`${date}|${time}`);
            setHoveredParticipantId(null);
        }
    }

    function handleGridTouchStart(e: React.TouchEvent) {
        if (e.touches.length !== 1) {
            touchStartRef.current = null;
            return;
        }
        const t = e.touches[0]!;
        touchStartRef.current = { x: t.clientX, y: t.clientY };
    }

    function handleGridTouchEnd(e: React.TouchEvent) {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        // Don't page while painting; only react to a clearly horizontal swipe.
        if (!start || isDraggingRef.current) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) setPage((p) => Math.min(pages - 1, p + 1));
            else setPage((p) => Math.max(0, p - 1));
        }
    }

    function addAvailability() {
        if (!canParticipate || readOnly || saved) return;
        const next: Record<string, SlotStatus> = { ...selected };
        for (const d of dates) {
            for (const t of slots) {
                const key = `${d}|${t}`;
                if (!calendarUnavailable[key]) next[key] = "AVAILABLE";
            }
        }
        setFillingWave(true);
        setSelected(next);
        setIsEditing(true);
        const maxDelay =
            (Math.max(visibleDates.length, 1) + Math.max(slots.length, 1)) *
                15 +
            220;
        window.setTimeout(() => setFillingWave(false), maxDelay);
    }

    async function copyShareLink() {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            alert("Kunne ikke kopiere lenken.");
        }
    }

    function handleLockedModePrimaryClick() {
        if (!canParticipate || readOnly) return;
        if (saved) {
            setIsEditing(true);
        } else {
            addAvailability();
        }
    }

    function cancelAvailabilityEdit() {
        setSelected({ ...persistedSelected });
        setIsEditing(false);
    }

    async function submitAvailability() {
        if (!canParticipate) return;
        const payload = Object.entries(selected).map(([key, status]) => {
            const i = key.indexOf("|");
            return { date: key.slice(0, i), time: key.slice(i + 1), status };
        });
        try {
            const res = await onSave(payload);
            setParticipantId(res.participantId);
            setSaved(true);
            setIsEditing(false);
            setPersistedSelected(selected);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Lagring feilet.";
            alert(message);
        }
    }

    const syncGoogleCalendar = useCallback(
        async (opts?: { auto?: boolean }) => {
            const auto = opts?.auto ?? false;
            let result: SyncCalendarResult;
            try {
                result = await onSyncCalendar();
            } catch {
                alert("Synkronisering feilet.");
                return;
            }

            if (!result.ok) {
                if (result.requiresReconnect && !auto) {
                    await onConnectCalendar(`/motetid/${slug}?calendarSync=1`);
                    return;
                }
                if (!auto) alert(result.error || "Synkronisering feilet.");
                return;
            }

            const blockedMap = Object.fromEntries(
                result.blocked.map((k) => [k, true]),
            );
            setCalendarUnavailable(blockedMap);
            setCalendarEvents(result.events);
            try {
                const payload: CalendarBoardCache = {
                    blocked: result.blocked,
                    events: result.events,
                    syncedAt: Date.now(),
                };
                sessionStorage.setItem(
                    calendarBoardCacheKey(slug),
                    JSON.stringify(payload),
                );
            } catch {
                /* quota / private mode */
            }
        },
        [slug, onSyncCalendar, onConnectCalendar],
    );

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("calendarSync") !== "1") return;
        if (!viewer.isAuthenticated) return;

        setIsEditing(true);
        void syncGoogleCalendar({ auto: true });

        params.delete("calendarSync");
        const qs = params.toString();
        const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
    }, [viewer.isAuthenticated, syncGoogleCalendar]);

    const renderModeToggle = () => (
        <div
            className="flex w-full flex-col gap-2"
            role="group"
            aria-label="Fyllmodus"
        >
            <span className="text-xs font-medium text-muted-foreground">
                Modus
            </span>
            <MotetidModeToggle
                mode={fillMode}
                onModeChange={setFillMode}
                disabled={!canParticipate || readOnly || !isEditing}
            />
        </div>
    );

    const renderHeatmapToggle = () => (
        <div
            className="flex w-full flex-col gap-2"
            role="group"
            aria-label="Visning av tilgjengelighet"
        >
            <span className="text-xs font-medium text-muted-foreground">
                Visning
            </span>
            <div className="flex w-full items-center justify-between gap-2">
                <Label
                    htmlFor="motetid-count-if-needed"
                    className="min-w-0 text-xs font-medium"
                >
                    Tell med «om nødvendig»
                </Label>
                <Switch
                    id="motetid-count-if-needed"
                    checked={countIfNeeded}
                    onCheckedChange={(checked) =>
                        setCountIfNeeded(Boolean(checked))
                    }
                />
            </div>
            <MotetidHeatLegend />
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {!canParticipate ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-medium">
                        Logg inn for å fylle ut tilgjengelighet
                    </p>
                    <p className="mt-1">
                        Du må være innlogget for å legge inn tider og lagre.
                    </p>
                    <Link
                        to="/login"
                        search={{ redirectTo: `/motetid/${slug}` }}
                        className="mt-2 inline-block text-sm font-medium underline"
                    >
                        Gå til innlogging
                    </Link>
                </div>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyShareLink()}
                    >
                        {copied ? "Kopiert!" : "Del lenke"}
                    </Button>
                    {viewer.isAuthenticated && !isWeekdayMode ? (
                        <div className="flex min-w-0 flex-col">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void syncGoogleCalendar()}
                                disabled={!canParticipate || readOnly}
                            >
                                Synkroniser Google Kalender
                            </Button>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Kalenderaktiviteter markeres som utilgjengelige,
                                men kan overstyres med klikk.
                            </p>
                        </div>
                    ) : null}
                    <p className="min-w-0 shrink text-sm text-muted-foreground">
                        {saved ? "Lagret." : "Ikke lagret ennå."}
                    </p>
                    {isEditing ? (
                        <div className="hidden w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto lg:flex">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelAvailabilityEdit}
                                disabled={readOnly || !canParticipate}
                            >
                                Avbryt
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void submitAvailability()}
                                disabled={
                                    readOnly ||
                                    !canParticipate ||
                                    !hasUnsavedChanges
                                }
                            >
                                Lagre
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleLockedModePrimaryClick}
                            disabled={readOnly || !canParticipate}
                            className="w-full sm:ml-auto sm:w-auto"
                        >
                            <span
                                key={primaryBlinkNonce}
                                className={
                                    primaryBlinkNonce > 0
                                        ? "motetid-primary-nudge inline-block"
                                        : "inline-block"
                                }
                            >
                                {saved
                                    ? "Endre tilgjengelighet"
                                    : "Legg til tilgjengelighet"}
                            </span>
                        </Button>
                    )}
                </div>

                {pages > 1 && (
                    <div className="mb-3 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            ← Forrige
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Dager {page * daysPerPage + 1}–
                            {Math.min(
                                page * daysPerPage + daysPerPage,
                                dates.length,
                            )}{" "}
                            av {dates.length}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={page >= pages - 1}
                            onClick={() =>
                                setPage((p) => Math.min(pages - 1, p + 1))
                            }
                        >
                            Neste →
                        </Button>
                    </div>
                )}

                {isEditing ? (
                    <div className="mb-3 lg:hidden">{renderModeToggle()}</div>
                ) : showHeatmap ? (
                    <div className="mb-3 lg:hidden">
                        {renderHeatmapToggle()}
                    </div>
                ) : null}

                <div
                    className="flex flex-col gap-3 lg:flex-row lg:items-stretch"
                    onMouseLeave={() => {
                        setHoveredParticipantId(null);
                        setHoveredSlotKey(null);
                    }}
                >
                    <div
                        ref={gridScrollRef}
                        className="min-w-0 flex-1 overflow-x-auto"
                        onTouchStart={handleGridTouchStart}
                        onTouchEnd={handleGridTouchEnd}
                    >
                        <div
                            className="relative grid min-w-full select-none gap-0 text-sm"
                            style={{
                                touchAction: isEditing ? "none" : "pan-y",
                                gridTemplateColumns: `${timeColWidth}px repeat(${visibleDates.length}, minmax(0, 1fr))`,
                                gridTemplateRows: `${headerRowHeight}px repeat(${slots.length}, ${rowHeight}px)`,
                            }}
                        >
                            <MotetidGridHeadCell className="text-xs font-medium text-muted-foreground">
                                Tid
                            </MotetidGridHeadCell>
                            {visibleDates.map((date) => {
                                if (isWeekdayMode) {
                                    return (
                                        <MotetidGridHeadCell
                                            key={date}
                                            className="flex flex-col items-center justify-center text-center"
                                        >
                                            <span className="text-xs font-medium">
                                                {weekdayLabel(
                                                    date,
                                                    narrowGrid
                                                        ? "short"
                                                        : "long",
                                                )}
                                            </span>
                                        </MotetidGridHeadCell>
                                    );
                                }
                                const d = parseISO(date);
                                return (
                                    <MotetidGridHeadCell
                                        key={date}
                                        className="flex flex-col items-center justify-center text-center"
                                    >
                                        <span className="text-xs font-medium">
                                            {format(d, "d. MMM", {
                                                locale: nb,
                                            })}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(d, "EEE", { locale: nb })}
                                        </span>
                                    </MotetidGridHeadCell>
                                );
                            })}

                            {slots.map((time, timeIdx) => {
                                const [hourStr, minStr] = time.split(":");
                                const isHour = minStr === "00";
                                return (
                                    <Fragment key={time}>
                                        <MotetidTimeCell
                                            style={{ touchAction: "pan-y" }}
                                        >
                                            {isHour ? hourStr : ""}
                                        </MotetidTimeCell>
                                        {visibleDates.map((date, dateIndex) => {
                                            const key = `${date}|${time}`;
                                            const mine = selected[key];
                                            const isPainted =
                                                paintedSlots.has(key);
                                            const isCalendarUnavailable =
                                                calendarUnavailable[key];

                                            const staggerMs =
                                                fillingWave && canParticipate
                                                    ? (dateIndex + timeIdx) * 15
                                                    : 0;
                                            const transitionStyle = fillingWave
                                                ? {
                                                      transition:
                                                          "background-color 200ms ease-out",
                                                      transitionDelay: `${staggerMs}ms`,
                                                  }
                                                : undefined;

                                            const hoverActive = Boolean(
                                                hoveredParticipantId &&
                                                !isEditing &&
                                                hoveredSlots,
                                            );
                                            const hoveredStatus =
                                                hoverActive && hoveredSlots
                                                    ? hoveredSlots[key]
                                                    : undefined;
                                            const hoveredParticipant =
                                                hoveredParticipantId
                                                    ? participants.find(
                                                          (x) =>
                                                              x.id ===
                                                              hoveredParticipantId,
                                                      )
                                                    : undefined;

                                            const visual = cellVisual({
                                                key,
                                                mine,
                                                isPainted,
                                                hoverActive,
                                                hoveredStatus,
                                            });

                                            const people =
                                                peopleByCell[key] ?? [];
                                            const tooltip =
                                                hoverActive &&
                                                hoveredParticipant
                                                    ? hoveredStatus
                                                        ? `${hoveredParticipant.name}: ${hoveredStatus === "AVAILABLE" ? "Tilgjengelig" : "Om nødvendig"}`
                                                        : `${hoveredParticipant.name}: ikke tilgjengelig`
                                                    : people.length
                                                      ? people
                                                            .map(
                                                                (p) =>
                                                                    `${p.name}: ${p.status === "AVAILABLE" ? "Tilgjengelig" : "Om nødvendig"}`,
                                                            )
                                                            .join("\n")
                                                      : "Ingen ennå";

                                            const interactive =
                                                !readOnly &&
                                                canParticipate &&
                                                isEditing;
                                            const cellDisabled =
                                                readOnly || !canParticipate;

                                            const ifNeededOverlay =
                                                ((mine === "IF_NEEDED" &&
                                                    !heatmapView) ||
                                                    (hoverActive &&
                                                        hoveredStatus ===
                                                            "IF_NEEDED")) &&
                                                !isPainted;

                                            return (
                                                <MotetidCell
                                                    key={key}
                                                    data-slot-key={key}
                                                    title={tooltip}
                                                    style={transitionStyle}
                                                    tabIndex={
                                                        interactive ? 0 : -1
                                                    }
                                                    aria-disabled={!interactive}
                                                    visual={visual}
                                                    interactive={
                                                        interactive ||
                                                        hoverActive
                                                    }
                                                    firstColumn={
                                                        dateIndex === 0
                                                    }
                                                    calendarBlocked={
                                                        Boolean(
                                                            isCalendarUnavailable,
                                                        ) && !isPainted
                                                    }
                                                    ifNeededOverlay={
                                                        ifNeededOverlay
                                                    }
                                                    onPointerDown={(e) => {
                                                        if (e.button !== 0)
                                                            return;
                                                        handleCellMouseDown(
                                                            date,
                                                            time,
                                                        );
                                                    }}
                                                    onMouseEnter={() =>
                                                        handleCellMouseEnter(
                                                            date,
                                                            time,
                                                        )
                                                    }
                                                    onClick={(e) => {
                                                        if (!interactive)
                                                            e.preventDefault();
                                                    }}
                                                    disabled={cellDisabled}
                                                />
                                            );
                                        })}
                                    </Fragment>
                                );
                            })}
                            {calendarOverlayPlacements.map((p) => (
                                <MotetidCalendarOverlayBlock
                                    key={p.key}
                                    style={{
                                        gridColumn: `${p.dateCol + 2} / ${p.dateCol + 3}`,
                                        gridRow: `${p.rowStart} / ${p.rowEnd}`,
                                        zIndex: p.zIndex,
                                        marginLeft: p.layer * 3,
                                        marginRight: p.layer * 3,
                                    }}
                                >
                                    <span className="line-clamp-2">
                                        {p.title}
                                    </span>
                                </MotetidCalendarOverlayBlock>
                            ))}
                        </div>
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 lg:w-52">
                        <div className="hidden lg:block">
                            {renderModeToggle()}
                        </div>
                        {!isEditing && showHeatmap ? (
                            <div className="hidden lg:block">
                                {renderHeatmapToggle()}
                            </div>
                        ) : null}

                        <div
                            className="min-w-0 border-t border-border pt-3"
                            aria-label="Deltakere med tilgjengelighet"
                        >
                            <span className="text-xs font-medium text-muted-foreground">
                                Deltakere
                            </span>
                            {participantsWithAvailability.length > 0 ? (
                                <ul className="mt-2 list-none space-y-1">
                                    {participantsWithAvailability.map((p) => {
                                        const unavailableAtHover = Boolean(
                                            availableAtHoveredSlot &&
                                            !availableAtHoveredSlot.has(p.id),
                                        );
                                        return (
                                            <li
                                                key={p.id}
                                                className={`min-w-0 cursor-pointer text-sm transition-opacity ${
                                                    unavailableAtHover
                                                        ? "line-through opacity-40"
                                                        : "hover:opacity-60"
                                                }`}
                                                onMouseEnter={() => {
                                                    setHoveredParticipantId(
                                                        p.id,
                                                    );
                                                    setHoveredSlotKey(null);
                                                }}
                                                onPointerDown={(e) => {
                                                    if (
                                                        e.pointerType !==
                                                        "touch"
                                                    )
                                                        return;
                                                    setHoveredParticipantId(
                                                        (id) =>
                                                            id === p.id
                                                                ? null
                                                                : p.id,
                                                    );
                                                }}
                                            >
                                                {p.name}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Ingen har lagret ennå
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {isEditing ? (
                    <div className="sticky bottom-0 z-30 -mx-4 mt-3 flex gap-2 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={cancelAvailabilityEdit}
                            disabled={readOnly || !canParticipate}
                        >
                            Avbryt
                        </Button>
                        <Button
                            type="button"
                            className="flex-1"
                            onClick={() => void submitAvailability()}
                            disabled={
                                readOnly ||
                                !canParticipate ||
                                !hasUnsavedChanges
                            }
                        >
                            Lagre
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
