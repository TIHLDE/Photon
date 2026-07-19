"use client";

import * as React from "react";
import { ClockIcon } from "lucide-react";

import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
} from "#/components/ui/input-group";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "#/components/ui/popover";

export type TimeValue = { hour: number; minute: number };

interface TimePickerProps {
    value: TimeValue | null;
    onValueChange: (value: TimeValue | null) => void;
    minuteStep?: number;
    disabled?: boolean;
    id?: string;
    name?: string;
    className?: string;
    "aria-invalid"?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

function clampNumber(text: string, max: number): number | null {
    if (text === "") return null;
    const n = parseInt(text, 10);
    if (Number.isNaN(n) || n < 0 || n > max) return null;
    return n;
}

function valuesEqual(a: TimeValue | null, b: TimeValue | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a.hour === b.hour && a.minute === b.minute;
}

export function TimePicker({
    value,
    onValueChange,
    minuteStep = 5,
    disabled,
    id,
    name,
    className,
    "aria-invalid": ariaInvalid,
}: TimePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [pendingHour, setPendingHour] = React.useState<number | null>(null);
    const [pendingMinute, setPendingMinute] = React.useState<number | null>(
        null,
    );
    const [hourText, setHourText] = React.useState(() =>
        value ? pad(value.hour) : "",
    );
    const [minuteText, setMinuteText] = React.useState(() =>
        value ? pad(value.minute) : "",
    );

    const hourRef = React.useRef<HTMLInputElement>(null);
    const minuteRef = React.useRef<HTMLInputElement>(null);
    const lastFocusedRef = React.useRef<"hour" | "minute" | null>(null);
    const initialFocusRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        setHourText(value ? pad(value.hour) : "");
        setMinuteText(value ? pad(value.minute) : "");
    }, [value]);

    React.useEffect(() => {
        if (open) {
            setPendingHour(value?.hour ?? null);
            setPendingMinute(value?.minute ?? null);
        }
    }, [open, value]);

    const minutes = React.useMemo(() => {
        const step = Math.max(1, Math.min(30, Math.floor(minuteStep)));
        const out: number[] = [];
        for (let m = 0; m < 60; m += step) out.push(m);
        return out;
    }, [minuteStep]);

    const emit = (next: TimeValue | null) => {
        if (!valuesEqual(next, value)) onValueChange(next);
    };

    const tryCommit = (h: number | null, m: number | null) => {
        if (h !== null && m !== null) emit({ hour: h, minute: m });
    };

    const currentHourText = () => hourRef.current?.value ?? "";
    const currentMinuteText = () => minuteRef.current?.value ?? "";

    const computeInitialFocusTarget = (): HTMLInputElement | null => {
        const hText = currentHourText();
        const mText = currentMinuteText();
        // HH already complete and MM still empty → continue in MM.
        if (hText.length === 2 && mText.length < 2) return minuteRef.current;
        if (lastFocusedRef.current === "minute") return minuteRef.current;
        return hourRef.current;
    };

    const handleOpenChange = (next: boolean) => {
        if (next) {
            initialFocusRef.current = computeInitialFocusTarget();
        } else {
            lastFocusedRef.current = null;
            initialFocusRef.current = null;
        }
        setOpen(next);
    };

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        setHourText(raw);
        const h = clampNumber(raw, 23);
        setPendingHour(h);
        if (raw.length === 2 && h !== null) {
            minuteRef.current?.focus();
            minuteRef.current?.select();
            const m = clampNumber(currentMinuteText(), 59);
            if (m !== null) emit({ hour: h, minute: m });
            else if (value) emit({ hour: h, minute: value.minute });
        }
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        setMinuteText(raw);
        const m = clampNumber(raw, 59);
        setPendingMinute(m);
        if (raw.length === 2 && m !== null) {
            const h = clampNumber(currentHourText(), 23);
            if (h !== null) emit({ hour: h, minute: m });
            else if (value) emit({ hour: value.hour, minute: m });
        }
    };

    const handleHourBlur = () => {
        const text = currentHourText();
        if (text === "") {
            if (value !== null) emit(null);
            return;
        }
        const h = clampNumber(text, 23);
        if (h === null) {
            setHourText(value ? pad(value.hour) : "");
            return;
        }
        setHourText(pad(h));
        const m = clampNumber(currentMinuteText(), 59);
        if (m !== null) tryCommit(h, m);
        else if (value) emit({ hour: h, minute: value.minute });
    };

    const handleMinuteBlur = () => {
        const text = currentMinuteText();
        if (text === "") {
            if (value !== null) emit(null);
            return;
        }
        const m = clampNumber(text, 59);
        if (m === null) {
            setMinuteText(value ? pad(value.minute) : "");
            return;
        }
        setMinuteText(pad(m));
        const h = clampNumber(currentHourText(), 23);
        if (h !== null) tryCommit(h, m);
        else if (value) emit({ hour: value.hour, minute: m });
    };

    const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = hourRef.current;
        if (!input) return;
        if (
            e.key === "ArrowRight" &&
            input.selectionEnd === input.value.length
        ) {
            e.preventDefault();
            minuteRef.current?.focus();
            const m = minuteRef.current;
            requestAnimationFrame(() => m?.setSelectionRange(0, 0));
        }
    };

    const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = minuteRef.current;
        if (!input) return;
        if (e.key === "Backspace" && input.value === "") {
            e.preventDefault();
            const len = currentHourText().length;
            hourRef.current?.focus();
            requestAnimationFrame(() =>
                hourRef.current?.setSelectionRange(len, len),
            );
            return;
        }
        if (e.key === "ArrowLeft" && input.selectionStart === 0) {
            e.preventDefault();
            const len = currentHourText().length;
            hourRef.current?.focus();
            requestAnimationFrame(() =>
                hourRef.current?.setSelectionRange(len, len),
            );
        }
    };

    const selectHourFromColumn = (hour: number) => {
        setPendingHour(hour);
        setHourText(pad(hour));
        if (value !== null) {
            emit({ hour, minute: value.minute });
            return;
        }
        if (pendingMinute !== null) tryCommit(hour, pendingMinute);
    };

    const selectMinuteFromColumn = (minute: number) => {
        setPendingMinute(minute);
        setMinuteText(pad(minute));
        if (value !== null) {
            emit({ hour: value.hour, minute });
            return;
        }
        if (pendingHour !== null) tryCommit(pendingHour, minute);
    };

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    const focusHourFromBackground = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.closest("button")) return;
        // Let PopoverTrigger toggle; the layout effect will pick the right
        // input based on lastFocusedRef + content state. No preventDefault —
        // base-ui honors it and would skip the toggle.
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
            <PopoverTrigger
                render={
                    <InputGroup
                        onClick={focusHourFromBackground}
                        aria-label="Tidsvelger"
                        className={cn("w-28 min-w-28 cursor-text", className)}
                    />
                }
            >
                <input
                    ref={hourRef}
                    id={id}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="HH"
                    disabled={disabled}
                    aria-invalid={ariaInvalid}
                    aria-label="Hours"
                    maxLength={2}
                    value={hourText}
                    onChange={handleHourChange}
                    onClick={stop}
                    onKeyDown={handleHourKeyDown}
                    onFocus={(e) => {
                        lastFocusedRef.current = "hour";
                        e.target.select();
                        if (!open) handleOpenChange(true);
                    }}
                    onBlur={handleHourBlur}
                    data-slot="input-group-control"
                    className="field-sizing-content min-w-[2ch] bg-transparent pl-2 pr-0! text-left text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                />
                <span
                    aria-hidden="true"
                    onClick={stop}
                    className="text-sm font-medium text-muted-foreground select-none"
                >
                    :
                </span>
                <input
                    ref={minuteRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="mm"
                    disabled={disabled}
                    aria-label="Minutes"
                    maxLength={2}
                    value={minuteText}
                    onChange={handleMinuteChange}
                    onKeyDown={handleMinuteKeyDown}
                    onClick={stop}
                    onFocus={(e) => {
                        lastFocusedRef.current = "minute";
                        e.target.select();
                        if (!open) handleOpenChange(true);
                    }}
                    onBlur={handleMinuteBlur}
                    data-slot="input-group-control"
                    className="field-sizing-content min-w-[2ch] bg-transparent pr-0! text-left text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                />
                <input
                    type="hidden"
                    name={name}
                    value={
                        value ? `${pad(value.hour)}:${pad(value.minute)}` : ""
                    }
                />
                <div aria-hidden="true" className="flex-1" />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        disabled={disabled}
                        aria-label="Velg tid"
                        tabIndex={-1}
                    >
                        <ClockIcon />
                    </InputGroupButton>
                </InputGroupAddon>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0"
                align="start"
                sideOffset={6}
                initialFocus={initialFocusRef}
                aria-label="Velg tid"
            >
                <div
                    className="flex items-stretch p-1"
                    role="group"
                    aria-label="Time picker"
                >
                    <TimeColumn
                        label="Hours"
                        items={HOURS}
                        value={pendingHour}
                        onSelect={selectHourFromColumn}
                    />
                    <div
                        aria-hidden="true"
                        className="flex items-center px-1 text-sm font-medium text-muted-foreground select-none"
                    >
                        :
                    </div>
                    <TimeColumn
                        label="Minutes"
                        items={minutes}
                        value={pendingMinute}
                        onSelect={selectMinuteFromColumn}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface TimeColumnProps {
    label: string;
    items: number[];
    value: number | null;
    onSelect: (n: number) => void;
}

function TimeColumn({ label, items, value, onSelect }: TimeColumnProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const selectedRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        const container = containerRef.current;
        const button = selectedRef.current;
        if (!container || !button) return;
        container.scrollTop =
            button.offsetTop -
            container.clientHeight / 2 +
            button.clientHeight / 2;
    }, []);

    return (
        <div
            ref={containerRef}
            role="listbox"
            aria-label={label}
            className="flex max-h-56 w-9 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {items.map((n) => {
                const selected = value === n;
                return (
                    <Button
                        key={n}
                        ref={selected ? selectedRef : undefined}
                        type="button"
                        variant="ghost"
                        size="sm"
                        role="option"
                        aria-selected={selected}
                        data-selected={selected || undefined}
                        onClick={() => onSelect(n)}
                        className={cn(
                            "h-7 w-9 justify-center px-0 font-normal tabular-nums",
                            selected &&
                                "bg-primary text-primary-foreground ring-2 ring-ring/50 hover:bg-primary! hover:text-primary-foreground!",
                        )}
                    >
                        {pad(n)}
                    </Button>
                );
            })}
        </div>
    );
}
