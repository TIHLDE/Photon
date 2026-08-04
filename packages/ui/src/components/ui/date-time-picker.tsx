"use client";

import * as React from "react";
import {
    endOfDay,
    format as formatDateFn,
    setHours,
    setMinutes,
    startOfDay,
} from "date-fns";
import { type Locale } from "react-day-picker";

import { cn } from "#/lib/utils";
import { DatePicker } from "#/components/ui/date-picker";
import { TimePicker, type TimeValue } from "#/components/ui/time-picker";

interface DateTimePickerProps {
    value: Date | null;
    onValueChange: (value: Date | null) => void;
    placeholder?: string;
    minuteStep?: number;
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

function combine(day: Date, time: TimeValue): Date {
    return setMinutes(setHours(startOfDay(day), time.hour), time.minute);
}

export function DateTimePicker({
    value,
    onValueChange,
    placeholder = "Velg dato",
    minuteStep,
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
    // Lets the user pick a time before a date without losing the input.
    const [pendingTime, setPendingTime] = React.useState<TimeValue | null>(
        null,
    );

    const time = React.useMemo<TimeValue | null>(
        () =>
            value
                ? { hour: value.getHours(), minute: value.getMinutes() }
                : pendingTime,
        [value, pendingTime],
    );

    const handleDateChange = (day: Date | null) => {
        if (!day) {
            onValueChange(null);
            return;
        }
        onValueChange(combine(day, time ?? { hour: 0, minute: 0 }));
    };

    const handleTimeChange = (next: TimeValue | null) => {
        setPendingTime(next);
        if (!value || !next) return;
        onValueChange(combine(value, next));
    };

    return (
        <div className={cn("flex items-start gap-2", className)}>
            <DatePicker
                id={id}
                value={value}
                onValueChange={handleDateChange}
                placeholder={placeholder}
                disabled={disabled}
                locale={locale}
                // Only the day matters here — the time part is picked
                // separately, so widen the bounds to whole days.
                minDate={minDate ? startOfDay(minDate) : undefined}
                maxDate={maxDate ? endOfDay(maxDate) : undefined}
                // Compact by default — the time field sits right next to it,
                // so the pair has to survive half-width columns.
                formatLabel={(date) =>
                    formatLabel
                        ? formatLabel(date)
                        : formatDateFn(date, "PP", { locale })
                }
                aria-invalid={ariaInvalid}
                className="min-w-0 flex-1"
            />
            <TimePicker
                value={time}
                onValueChange={handleTimeChange}
                minuteStep={minuteStep}
                disabled={disabled}
                aria-invalid={ariaInvalid}
                className="shrink-0"
            />
            {name !== undefined && (
                <input
                    type="hidden"
                    name={name}
                    value={value ? value.toISOString() : ""}
                />
            )}
        </div>
    );
}
