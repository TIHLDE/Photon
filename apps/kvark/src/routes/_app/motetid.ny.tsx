import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Field, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { MotetidCalendarDay } from "@tihlde/ui/ui/motetid-grid";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isBefore,
    isToday,
    parse,
    startOfMonth,
    startOfToday,
    subMonths,
} from "date-fns";
import { nb } from "date-fns/locale";
import { useRef, useState } from "react";

import { authClientWithRedirect } from "#/api/auth";
import { createMotetidEventMutation } from "#/api/queries/motetid";
import {
    type DateMode,
    normalizeDates,
    WEEKDAYS,
    weekdayLabel,
} from "#/lib/motetid-grid";

export const Route = createFileRoute("/_app/motetid/ny")({
    component: CreateMotetidEventPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
});

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? "00" : "30";
    const value = `${String(h).padStart(2, "0")}:${m}`;
    const label = `${h}:${m}`;
    return { value, label };
});

function CreateMotetidEventPage() {
    const navigate = useNavigate();
    const create = useMutation(createMotetidEventMutation);

    const [title, setTitle] = useState("");
    const [titleTouched, setTitleTouched] = useState(false);
    const [dateMode, setDateMode] = useState<DateMode>("DATES");
    // Kept apart so switching mode back and forth never discards a selection.
    const [dates, setDates] = useState<string[]>([]);
    const [weekdays, setWeekdays] = useState<string[]>([]);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

    const isDraggingRef = useRef(false);
    const dragModeRef = useRef<"add" | "remove">("add");
    const activePointerIdRef = useRef<number | null>(null);
    const today = startOfToday();

    const isWeekdayMode = dateMode === "WEEKDAYS";
    const selectedColumns = isWeekdayMode ? weekdays : dates;
    const titleError = title.trim().length < 2;
    const datesError = selectedColumns.length === 0;
    const showErrors = submitted;

    function toggleWeekday(key: string) {
        setWeekdays((prev) =>
            normalizeDates(
                prev.includes(key)
                    ? prev.filter((x) => x !== key)
                    : [...prev, key],
                "WEEKDAYS",
            ),
        );
    }

    function applyDayWhileDragging(dateStr: string) {
        if (!isDraggingRef.current) return;
        const d = parse(dateStr, "yyyy-MM-dd", new Date());
        if (isBefore(d, today)) return;
        setDates((prev) => {
            if (dragModeRef.current === "add") {
                return prev.includes(dateStr)
                    ? prev
                    : [...prev, dateStr].sort();
            }
            return prev.filter((x) => x !== dateStr);
        });
    }

    function handleDayPointerDown(e: React.PointerEvent, d: Date) {
        if (e.button !== 0) return;
        if (isBefore(d, today)) return;
        e.preventDefault();
        const str = format(d, "yyyy-MM-dd");
        const isSelected = dates.includes(str);
        dragModeRef.current = isSelected ? "remove" : "add";
        isDraggingRef.current = true;
        activePointerIdRef.current = e.pointerId;
        setDates((prev) =>
            isSelected ? prev.filter((x) => x !== str) : [...prev, str].sort(),
        );

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== activePointerIdRef.current) return;
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const btn = el?.closest(
                "[data-cal-day]",
            ) as HTMLButtonElement | null;
            const dayStr = btn?.dataset.calDay;
            if (!dayStr) return;
            applyDayWhileDragging(dayStr);
        };

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== activePointerIdRef.current) return;
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onEnd);
            document.removeEventListener("pointercancel", onEnd);
            isDraggingRef.current = false;
            activePointerIdRef.current = null;
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onEnd);
        document.addEventListener("pointercancel", onEnd);
    }

    function handleDayPointerEnter(d: Date) {
        if (!isDraggingRef.current) return;
        const str = format(d, "yyyy-MM-dd");
        applyDayWhileDragging(str);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitted(true);
        setSubmitError(null);
        if (titleError || datesError) return;
        try {
            const created = await create.mutateAsync({
                data: {
                    title: title.trim(),
                    dateMode,
                    dates: selectedColumns,
                    startTime,
                    endTime,
                },
            });
            await navigate({
                to: "/motetid/$slug",
                params: { slug: created.slug },
            });
        } catch {
            setSubmitError("Kunne ikke opprette arrangementet. Prøv igjen.");
        }
    }

    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd,
    });
    const firstDayOffset = (getDay(monthStart) + 6) % 7;

    return (
        <div className="container mx-auto w-full max-w-2xl px-4 py-8">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 sm:p-6"
            >
                <div>
                    <Button variant="link" render={<Link to="/motetid" />}>
                        ← Tilbake til oversikten
                    </Button>
                </div>
                <div>
                    <h1 className="text-xl font-semibold">Nytt arrangement</h1>
                    <p className="text-sm text-muted-foreground">
                        Perfekt for engangs- eller faste møter
                    </p>
                </div>

                <Field>
                    <FieldLabel htmlFor="motetid-title">
                        Navn på arrangement
                    </FieldLabel>
                    <Input
                        id="motetid-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => setTitleTouched(true)}
                        placeholder="Gi arrangementet et navn..."
                        aria-invalid={
                            (titleTouched || showErrors) && titleError
                        }
                        maxLength={200}
                    />
                    {(titleTouched || showErrors) && titleError && (
                        <p className="text-xs text-destructive">
                            Navn på arrangement er påkrevd
                        </p>
                    )}
                </Field>

                <div className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold">
                        Hvilke tider kan passe?
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            items={TIME_OPTIONS}
                            value={startTime}
                            onValueChange={(v) => setStartTime(v ?? "09:00")}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIME_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">
                            til
                        </span>
                        <Select
                            items={TIME_OPTIONS}
                            value={endTime}
                            onValueChange={(v) => setEndTime(v ?? "17:00")}
                        >
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIME_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold">
                        {isWeekdayMode
                            ? "Hvilke ukedager kan passe?"
                            : "Hvilke datoer kan passe?"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {isWeekdayMode
                            ? "Velg ukedager når dere skal finne et fast møtetidspunkt"
                            : "Velg datoer når dere skal finne én dag som passer. Dra for å velge flere"}
                    </p>

                    <Tabs
                        value={dateMode}
                        onValueChange={(v) => setDateMode(v as DateMode)}
                    >
                        <TabsList>
                            <TabsTrigger value="DATES">Datoer</TabsTrigger>
                            <TabsTrigger value="WEEKDAYS">Ukedager</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {isWeekdayMode ? (
                        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-4 sm:grid-cols-4">
                            {WEEKDAYS.map((key) => (
                                <MotetidCalendarDay
                                    key={key}
                                    state={
                                        weekdays.includes(key)
                                            ? "selected"
                                            : "default"
                                    }
                                    aria-pressed={weekdays.includes(key)}
                                    onClick={() => toggleWeekday(key)}
                                >
                                    {weekdayLabel(key)}
                                </MotetidCalendarDay>
                            ))}
                        </div>
                    ) : (
                        <div className="select-none rounded-lg border border-border p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Forrige måned"
                                    onClick={() =>
                                        setViewMonth((m) => subMonths(m, 1))
                                    }
                                >
                                    ‹
                                </Button>
                                <span className="text-sm font-semibold">
                                    {format(viewMonth, "MMMM yyyy", {
                                        locale: nb,
                                    })}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Neste måned"
                                    onClick={() =>
                                        setViewMonth((m) => addMonths(m, 1))
                                    }
                                >
                                    ›
                                </Button>
                            </div>

                            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                                {["M", "T", "O", "T", "F", "L", "S"].map(
                                    (d, i) => (
                                        <div key={i} className="py-1">
                                            {d}
                                        </div>
                                    ),
                                )}
                            </div>

                            <div
                                className="grid grid-cols-7 gap-1"
                                style={{ touchAction: "none" }}
                            >
                                {Array.from(
                                    { length: firstDayOffset },
                                    (_, i) => (
                                        <div key={`empty-${i}`} />
                                    ),
                                )}
                                {daysInMonth.map((d) => {
                                    const str = format(d, "yyyy-MM-dd");
                                    const isPast = isBefore(d, today);
                                    const isSelected = dates.includes(str);
                                    const state = isPast
                                        ? "past"
                                        : isSelected
                                          ? "selected"
                                          : isToday(d)
                                            ? "today"
                                            : "default";
                                    return (
                                        <MotetidCalendarDay
                                            key={str}
                                            data-cal-day={str}
                                            state={state}
                                            disabled={isPast}
                                            onPointerDown={(e) =>
                                                handleDayPointerDown(e, d)
                                            }
                                            onPointerEnter={() =>
                                                handleDayPointerEnter(d)
                                            }
                                        >
                                            {format(d, "d")}
                                        </MotetidCalendarDay>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {showErrors && datesError && (
                        <p className="text-xs text-destructive">
                            {isWeekdayMode
                                ? "Velg minst én ukedag"
                                : "Velg minst én dato"}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={create.isPending}
                    >
                        {create.isPending
                            ? "Oppretter..."
                            : "Opprett arrangement"}
                    </Button>
                    {showErrors && (titleError || datesError) && (
                        <p className="text-center text-xs text-destructive">
                            Rett opp feil i skjemaet før du fortsetter
                        </p>
                    )}
                    {submitError && (
                        <p className="text-center text-xs text-destructive">
                            {submitError}
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
}
