import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    const [copied, setCopied] = useState(false);
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
            // Utklippstavla kan være blokkert; da markerer vi teksten i
            // stedet så brukeren kan kopiere selv.
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Kalender-abonnement</CardTitle>
                <CardDescription>
                    Arrangementene du er påmeldt rett inn i kalenderen din. Nye
                    påmeldinger dukker opp av seg selv — hvor raskt avhenger av
                    kalenderen, noen sjekker bare én gang i døgnet.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 overflow-x-auto">
                        {url}
                    </code>
                    <Button type="button" onClick={() => void copy()}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Kopiert" : "Kopier lenke"}
                    </Button>
                </div>
                <CardDescription>
                    Lim lenka inn i{" "}
                    <a
                        href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Google Kalender
                    </a>
                    ,{" "}
                    <a
                        href="https://support.apple.com/no-no/guide/calendar/icl1022/mac"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Apple Kalender
                    </a>{" "}
                    eller{" "}
                    <a
                        href="https://support.microsoft.com/nb-no/office/cff1429c-5af6-41ec-a5b4-74f2c278e98c"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Outlook
                    </a>
                    . Hvem som helst med lenka kan se påmeldingene dine, så del
                    den ikke videre.
                </CardDescription>
                <div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                    >
                        <RefreshCw />
                        Lag ny lenke
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
