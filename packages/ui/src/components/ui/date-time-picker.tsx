"use client";

import * as React from "react";
import {
    format as formatDateFn,
    isAfter,
    isBefore,
    setHours,
    setMinutes,
    startOfDay,
} from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { type Locale } from "react-day-picker";

import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { InputGroup, InputGroupAddon } from "#/components/ui/input-group";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "#/components/ui/popover";

interface DateTimePickerProps {
    value: Date | null;
    onValueChange: (value: Date | null) => void;
    placeholder?: string;
    disabled?: boolean;
    locale?: Locale;
    minDate?: Date;
    maxDate?: Date;
    id?: string;
    name?: string;
    className?: string;
    formatLabel?: (value: Date) => string;
    "aria-invalid"?: boolean;
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

function defaultFormat(date: Date, locale?: Locale): string {
    return formatDateFn(date, "PPP HH:mm", { locale });
}

function disabledMatcher(minDate?: Date, maxDate?: Date) {
    if (!minDate && !maxDate) return undefined;
    return (date: Date) => {
        if (minDate && isBefore(date, startOfDay(minDate))) return true;
        if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) {
            return true;
        }
        return false;
    };
}

function clampNumber(text: string, max: number): number | null {
    if (text === "") return null;
    const n = parseInt(text, 10);
    if (Number.isNaN(n) || n < 0 || n > max) return null;
    return n;
}

export function DateTimePicker({
    value,
    onValueChange,
    placeholder = "Pick a date",
    disabled,
    locale,
    minDate,
    maxDate,
    id,
    name,
    className,
    formatLabel,
    "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
    const [hourText, setHourText] = React.useState(() =>
        value ? pad(value.getHours()) : "",
    );
    const [minuteText, setMinuteText] = React.useState(() =>
        value ? pad(value.getMinutes()) : "",
    );

    const hourRef = React.useRef<HTMLInputElement>(null);
    const minuteRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setHourText(value ? pad(value.getHours()) : "");
        setMinuteText(value ? pad(value.getMinutes()) : "");
    }, [value]);

    const label = value
        ? formatLabel
            ? formatLabel(value)
            : defaultFormat(value, locale)
        : placeholder;

    const combine = (day: Date, hour: number, minute: number): Date => {
        return setMinutes(setHours(startOfDay(day), hour), minute);
    };

    const handleDaySelect = (day: Date | undefined) => {
        if (!day) {
            onValueChange(null);
            return;
        }
        const hour = value
            ? value.getHours()
            : (clampNumber(hourText, 23) ?? 0);
        const minute = value
            ? value.getMinutes()
            : (clampNumber(minuteText, 59) ?? 0);
        onValueChange(combine(day, hour, minute));
    };

    const commitTime = (hour: number | null, minute: number | null) => {
        if (!value) return;
        onValueChange(
            combine(
                value,
                hour ?? value.getHours(),
                minute ?? value.getMinutes(),
            ),
        );
    };

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        setHourText(raw);
        const h = clampNumber(raw, 23);
        if (h !== null) {
            commitTime(h, clampNumber(minuteRef.current?.value ?? "", 59));
            if (raw.length === 2) {
                minuteRef.current?.focus();
                minuteRef.current?.select();
            }
        }
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        setMinuteText(raw);
        const m = clampNumber(raw, 59);
        if (m !== null) {
            commitTime(clampNumber(hourRef.current?.value ?? "", 23), m);
        }
    };

    const handleHourBlur = () => {
        const h = clampNumber(hourText, 23);
        if (h === null) {
            setHourText(value ? pad(value.getHours()) : "");
            return;
        }
        setHourText(pad(h));
    };

    const handleMinuteBlur = () => {
        const m = clampNumber(minuteText, 59);
        if (m === null) {
            setMinuteText(value ? pad(value.getMinutes()) : "");
            return;
        }
        setMinuteText(pad(m));
    };

    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button
                        variant="outline"
                        type="button"
                        id={id}
                        disabled={disabled}
                        aria-invalid={ariaInvalid}
                        className={cn(
                            "w-full justify-between font-normal",
                            !value && "text-muted-foreground",
                            className,
                        )}
                    />
                }
            >
                <span className="truncate">{label}</span>
                <CalendarIcon className="size-4 shrink-0 opacity-60" />
            </PopoverTrigger>
            {name !== undefined && (
                <input
                    type="hidden"
                    name={name}
                    value={value ? value.toISOString() : ""}
                />
            )}
            <PopoverContent
                className="w-auto p-0"
                align="start"
                aria-label="Velg dato og tid"
            >
                <Calendar
                    mode="single"
                    selected={value ?? undefined}
                    onSelect={handleDaySelect}
                    startMonth={minDate}
                    endMonth={maxDate}
                    disabled={disabledMatcher(minDate, maxDate)}
                    locale={locale}
                    autoFocus
                />
                <div className="flex items-center gap-2 border-t p-3">
                    <InputGroup className="w-full">
                        <input
                            ref={hourRef}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="HH"
                            disabled={disabled}
                            aria-label="Timer"
                            maxLength={2}
                            value={hourText}
                            onChange={handleHourChange}
                            onFocus={(e) => e.target.select()}
                            onBlur={handleHourBlur}
                            data-slot="input-group-control"
                            className="field-sizing-content min-w-[2ch] bg-transparent pl-2 pr-0! text-left text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                        />
                        <span
                            aria-hidden="true"
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
                            aria-label="Minutter"
                            maxLength={2}
                            value={minuteText}
                            onChange={handleMinuteChange}
                            onFocus={(e) => e.target.select()}
                            onBlur={handleMinuteBlur}
                            data-slot="input-group-control"
                            className="field-sizing-content min-w-[2ch] bg-transparent pr-0! text-left text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                        />
                        <div aria-hidden="true" className="flex-1" />
                        <InputGroupAddon align="inline-end">
                            <ClockIcon className="opacity-60" />
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </PopoverContent>
        </Popover>
    );
}
