import { Button } from "@tihlde/ui/ui/button";
import { Card } from "@tihlde/ui/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import { Input } from "@tihlde/ui/ui/input";
import {
    CalendarDays,
    Check,
    ChevronDown,
    Copy,
    RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "#/lib/utils";

type CalendarSubscriptionProps = {
    url: string;
    onRegenerate: () => void;
    isRegenerating?: boolean;
};

/**
 * Viser den personlige kalenderlenka med kopiknapp. Lenka er hemmelig — den
 * gir tilgang til påmeldingene dine uten innlogging — så den kan byttes ut
 * hvis den kommer på avveie.
 */
export function CalendarSubscription({
    url,
    onRegenerate,
    isRegenerating = false,
}: CalendarSubscriptionProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        },
        [],
    );

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            if (resetTimer.current) clearTimeout(resetTimer.current);
            resetTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }

    return (
        <Card
            className="gap-0 py-0"
            render={<Collapsible open={open} onOpenChange={setOpen} />}
        >
            <CollapsibleTrigger
                render={
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 p-4"
                    />
                }
            >
                <CalendarDays
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1 text-left whitespace-normal">
                    <span className="text-sm font-medium">
                        Kalender-abonnement
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                        Få arrangementene du er påmeldt i kalenderen din.
                    </span>
                </span>
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent divided className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        ref={inputRef}
                        aria-label="Personlig kalenderlenke"
                        value={url}
                        readOnly
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1"
                    />
                    <Button type="button" onClick={() => void copy()}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Kopiert" : "Kopier lenke"}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Legg lenken til i{" "}
                    <a
                        className="underline underline-offset-4"
                        href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Google Kalender
                    </a>
                    ,{" "}
                    <a
                        className="underline underline-offset-4"
                        href="https://support.apple.com/no-no/guide/calendar/icl1022/mac"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Apple Kalender
                    </a>{" "}
                    eller{" "}
                    <a
                        className="underline underline-offset-4"
                        href="https://support.microsoft.com/nb-no/office/cff1429c-5af6-41ec-a5b4-74f2c278e98c"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Outlook
                    </a>
                    . Kalenderen oppdateres automatisk. I noen kalendere kan det
                    ta opptil 24 timer.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        Hold lenken privat – den viser påmeldingene dine.
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start sm:self-auto"
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                    >
                        <RefreshCw />
                        Lag ny lenke
                    </Button>
                </div>
            </CollapsibleContent>
        </Card>
    );
}
