"use client";

import * as React from "react";
import {
    addYears,
    endOfMonth,
    format as formatDateFn,
    isAfter,
    isBefore,
    isSameMonth,
    isSameYear,
    startOfMonth,
    startOfYear,
} from "date-fns";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type Locale } from "react-day-picker";

import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "#/components/ui/popover";

type DatePickerView = "day" | "month";

export type DateRange = { from: Date; to?: Date };

interface CommonProps {
    view?: DatePickerView;
    placeholder?: string;
    disabled?: boolean;
    locale?: Locale;
    minDate?: Date;
    maxDate?: Date;
    id?: string;
    name?: string;
    className?: string;
    "aria-invalid"?: boolean;
}

interface DatePickerProps extends CommonProps {
    value: Date | null;
    onValueChange: (value: Date | null) => void;
    formatLabel?: (value: Date, view: DatePickerView) => string;
}

interface DateRangePickerProps extends CommonProps {
    value: DateRange | null;
    onValueChange: (value: DateRange | null) => void;
    formatLabel?: (value: DateRange, view: DatePickerView) => string;
}

function defaultDayFormat(date: Date): string {
    return formatDateFn(date, "PPP");
}

function defaultMonthFormat(date: Date): string {
    return formatDateFn(date, "LLLL yyyy");
}

function defaultRangeDayFormat(range: DateRange): string {
    if (!range.to) return defaultDayFormat(range.from);
    return `${defaultDayFormat(range.from)} – ${defaultDayFormat(range.to)}`;
}

function defaultRangeMonthFormat(range: DateRange): string {
    if (!range.to || isSameMonth(range.from, range.to)) {
        return defaultMonthFormat(range.from);
    }
    return `${defaultMonthFormat(range.from)} – ${defaultMonthFormat(range.to)}`;
}

export function DatePicker({
    value,
    onValueChange,
    view = "day",
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
}: DatePickerProps) {
    const label = value
        ? formatLabel
            ? formatLabel(value, view)
            : view === "month"
              ? defaultMonthFormat(value)
              : defaultDayFormat(value)
        : placeholder;

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
                aria-label="Velg dato"
            >
                {view === "month" ? (
                    <MonthCalendarSingle
                        value={value}
                        onValueChange={onValueChange}
                        minDate={minDate}
                        maxDate={maxDate}
                        locale={locale}
                    />
                ) : (
                    <Calendar
                        mode="single"
                        selected={value ?? undefined}
                        onSelect={(next) => onValueChange(next ?? null)}
                        startMonth={minDate}
                        endMonth={maxDate}
                        disabled={disabledMatcher(minDate, maxDate)}
                        locale={locale}
                        autoFocus
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}

export function DateRangePicker({
    value,
    onValueChange,
    view = "day",
    placeholder = "Pick a date range",
    disabled,
    locale,
    minDate,
    maxDate,
    id,
    name,
    className,
    formatLabel,
    "aria-invalid": ariaInvalid,
}: DateRangePickerProps) {
    const label = value
        ? formatLabel
            ? formatLabel(value, view)
            : view === "month"
              ? defaultRangeMonthFormat(value)
              : defaultRangeDayFormat(value)
        : placeholder;

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
                    value={
                        value
                            ? `${value.from.toISOString()}/${value.to?.toISOString() ?? ""}`
                            : ""
                    }
                />
            )}
            <PopoverContent
                className="w-auto p-0"
                align="start"
                aria-label="Velg datoområde"
            >
                {view === "month" ? (
                    <MonthCalendarRange
                        value={value}
                        onValueChange={onValueChange}
                        minDate={minDate}
                        maxDate={maxDate}
                        locale={locale}
                    />
                ) : (
                    <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={
                            value
                                ? { from: value.from, to: value.to }
                                : undefined
                        }
                        onSelect={(next) => {
                            if (!next || !next.from) {
                                onValueChange(null);
                                return;
                            }
                            onValueChange({ from: next.from, to: next.to });
                        }}
                        startMonth={minDate}
                        endMonth={maxDate}
                        disabled={disabledMatcher(minDate, maxDate)}
                        locale={locale}
                        autoFocus
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}

function disabledMatcher(minDate?: Date, maxDate?: Date) {
    if (!minDate && !maxDate) return undefined;
    return (date: Date) => {
        if (minDate && isBefore(date, minDate)) return true;
        if (maxDate && isAfter(date, maxDate)) return true;
        return false;
    };
}

interface MonthCalendarSingleProps {
    value: Date | null;
    onValueChange: (value: Date | null) => void;
    minDate?: Date;
    maxDate?: Date;
    locale?: Locale;
}

function MonthCalendarSingle({
    value,
    onValueChange,
    minDate,
    maxDate,
    locale,
}: MonthCalendarSingleProps) {
    const [year, setYear] = React.useState(() =>
        value ? value.getFullYear() : new Date().getFullYear(),
    );

    const isSelected = (month: Date) =>
        value ? isSameMonth(month, value) : false;

    return (
        <MonthGrid
            year={year}
            onYearChange={setYear}
            isSelected={isSelected}
            isInRange={() => false}
            isRangeStart={isSelected}
            isRangeEnd={isSelected}
            onSelect={(month) =>
                onValueChange(
                    value && isSameMonth(month, value)
                        ? null
                        : startOfMonth(month),
                )
            }
            minDate={minDate}
            maxDate={maxDate}
            locale={locale}
        />
    );
}

interface MonthCalendarRangeProps {
    value: DateRange | null;
    onValueChange: (value: DateRange | null) => void;
    minDate?: Date;
    maxDate?: Date;
    locale?: Locale;
}

function MonthCalendarRange({
    value,
    onValueChange,
    minDate,
    maxDate,
    locale,
}: MonthCalendarRangeProps) {
    const [year, setYear] = React.useState(() =>
        value ? value.from.getFullYear() : new Date().getFullYear(),
    );

    const inRange = (month: Date) => {
        if (!value?.to) return false;
        const start = startOfMonth(value.from);
        const end = startOfMonth(value.to);
        const m = startOfMonth(month);
        return !isBefore(m, start) && !isAfter(m, end);
    };

    const isStart = (month: Date) =>
        value ? isSameMonth(month, value.from) : false;

    const isEnd = (month: Date) =>
        value?.to ? isSameMonth(month, value.to) : false;

    const handleSelect = (month: Date) => {
        const m = startOfMonth(month);
        if (!value || (value.from && value.to)) {
            onValueChange({ from: m });
            return;
        }
        if (isBefore(m, value.from)) {
            onValueChange({ from: m, to: endOfMonth(value.from) });
            return;
        }
        if (isSameMonth(m, value.from)) {
            onValueChange(null);
            return;
        }
        onValueChange({ from: value.from, to: endOfMonth(m) });
    };

    return (
        <MonthGrid
            year={year}
            onYearChange={setYear}
            isSelected={(m) => isStart(m) || isEnd(m)}
            isInRange={inRange}
            isRangeStart={isStart}
            isRangeEnd={isEnd}
            onSelect={handleSelect}
            minDate={minDate}
            maxDate={maxDate}
            locale={locale}
        />
    );
}

interface MonthGridProps {
    year: number;
    onYearChange: (year: number) => void;
    isSelected: (month: Date) => boolean;
    isInRange: (month: Date) => boolean;
    isRangeStart: (month: Date) => boolean;
    isRangeEnd: (month: Date) => boolean;
    onSelect: (month: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    locale?: Locale;
}

function MonthGrid({
    year,
    onYearChange,
    isSelected,
    isInRange,
    isRangeStart,
    isRangeEnd,
    onSelect,
    minDate,
    maxDate,
    locale,
}: MonthGridProps) {
    const months = React.useMemo(
        () =>
            Array.from(
                { length: 12 },
                (_, i) => new Date(year, i, 1, 0, 0, 0, 0),
            ),
        [year],
    );

    const yearStart = startOfYear(new Date(year, 0, 1));
    const prevDisabled = minDate
        ? isBefore(addYears(yearStart, -1), startOfYear(minDate)) &&
          !isSameYear(addYears(yearStart, -1), minDate)
        : false;
    const nextDisabled = maxDate
        ? isAfter(addYears(yearStart, 1), maxDate) &&
          !isSameYear(addYears(yearStart, 1), maxDate)
        : false;

    const isMonthDisabled = (month: Date) => {
        if (minDate && isBefore(endOfMonth(month), startOfMonth(minDate))) {
            return true;
        }
        if (maxDate && isAfter(startOfMonth(month), endOfMonth(maxDate))) {
            return true;
        }
        return false;
    };

    const monthLabel = (date: Date) =>
        date.toLocaleString(locale?.code, { month: "short" });
    const monthLongLabel = (date: Date) =>
        date.toLocaleString(locale?.code, { month: "long" });

    const gridRef = React.useRef<HTMLDivElement>(null);

    const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.getAttribute("role") !== "gridcell") return;
        const cells = Array.from(
            gridRef.current?.querySelectorAll<HTMLElement>(
                '[role="gridcell"]:not([disabled])',
            ) ?? [],
        );
        const index = cells.indexOf(target);
        if (index === -1) return;
        const move = (next: number) => {
            const wrapped = Math.max(0, Math.min(cells.length - 1, next));
            cells[wrapped]?.focus();
        };
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                move(index + 1);
                break;
            case "ArrowLeft":
                e.preventDefault();
                move(index - 1);
                break;
            case "ArrowDown":
                e.preventDefault();
                move(index + 3);
                break;
            case "ArrowUp":
                e.preventDefault();
                move(index - 3);
                break;
            case "Home":
                e.preventDefault();
                move(index - (index % 3));
                break;
            case "End":
                e.preventDefault();
                move(index - (index % 3) + 2);
                break;
            case "PageUp":
                e.preventDefault();
                onYearChange(year - 1);
                break;
            case "PageDown":
                e.preventDefault();
                onYearChange(year + 1);
                break;
        }
    };

    const monthRows = [
        months.slice(0, 3),
        months.slice(3, 6),
        months.slice(6, 9),
        months.slice(9, 12),
    ];

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onYearChange(year - 1)}
                    disabled={prevDisabled}
                    aria-label="Forrige år"
                >
                    <ChevronLeftIcon />
                </Button>
                <div
                    className="text-sm font-medium select-none"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {year}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onYearChange(year + 1)}
                    disabled={nextDisabled}
                    aria-label="Neste år"
                >
                    <ChevronRightIcon />
                </Button>
            </div>
            <div
                ref={gridRef}
                role="grid"
                aria-label={`Måneder i ${year}`}
                onKeyDown={handleGridKeyDown}
                className="flex flex-col gap-1"
            >
                {monthRows.map((row, rowIdx) => (
                    <div key={rowIdx} role="row" className="flex gap-1">
                        {row.map((month) => {
                            const selected = isSelected(month);
                            const inRange = isInRange(month);
                            const start = isRangeStart(month);
                            const end = isRangeEnd(month);
                            const disabled = isMonthDisabled(month);

                            return (
                                <Button
                                    key={month.getMonth()}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    role="gridcell"
                                    aria-selected={selected}
                                    aria-label={`${monthLongLabel(month)} ${year}`}
                                    disabled={disabled}
                                    onClick={() => onSelect(month)}
                                    data-selected={selected || undefined}
                                    data-in-range={inRange || undefined}
                                    data-range-start={start || undefined}
                                    data-range-end={end || undefined}
                                    className={cn(
                                        "h-9 flex-1 justify-center font-normal capitalize",
                                        inRange &&
                                            "bg-muted text-foreground hover:bg-muted! hover:text-foreground!",
                                        (start || end) &&
                                            "bg-primary text-primary-foreground ring-2 ring-ring/50 hover:bg-primary! hover:text-primary-foreground!",
                                    )}
                                >
                                    {monthLabel(month)}
                                </Button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
