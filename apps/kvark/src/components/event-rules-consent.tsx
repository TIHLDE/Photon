import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Label } from "@tihlde/ui/ui/label";
import { ScrollText } from "lucide-react";

export const EVENT_RULES_URL = "https://wiki.tihlde.org/arrangementer";

type EventRulesConsentProps = {
    /** Kalles når medlemmet huker av. Én handling — det finnes ingen angre. */
    onAccept: () => void;
    isSubmitting?: boolean;
    error?: string | null;
    /**
     * `banner` brukes over hele appen, `inline` inne i påmeldingskortet der
     * overskriften allerede er «Påmelding».
     */
    variant?: "banner" | "inline";
    /** Overstyrer linja under tittelen — den avhenger av påmeldingsstatus. */
    message?: string;
};

/**
 * Blokkeringen medlemmer møtte for sent i Lepton: reglene måtte godkjennes på
 * profilen, og de oppdaget det først idet påmeldingen åpnet — da var plassen
 * ofte tatt. Her kan de godkjenne der de står, uten å forlate siden.
 */
export function EventRulesConsent({
    onAccept,
    isSubmitting,
    error,
    variant = "banner",
    message,
}: EventRulesConsentProps) {
    const checkbox = (
        <div className="flex flex-col gap-2">
            <Label className="flex items-start gap-3">
                <Checkbox
                    className="shrink-0"
                    checked={false}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) => {
                        if (checked === true) onAccept();
                    }}
                />
                <span>Jeg har lest og godtar arrangementsreglene</span>
            </Label>
            {error ? <AlertDescription>{error}</AlertDescription> : null}
        </div>
    );

    if (variant === "inline") {
        return (
            <Alert>
                <ScrollText className="size-4" />
                <AlertTitle>Du må godkjenne arrangementsreglene</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                    <span>
                        {message ??
                            "Gjør det nå, så er du klar når påmeldingen åpner."}
                    </span>
                    {checkbox}
                    <RulesLink />
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            <ScrollText className="size-4" />
            <AlertTitle>Du må godkjenne arrangementsreglene</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <span>
                    Uten dette kan du ikke melde deg på arrangementer. Godkjenn
                    nå, så slipper du å miste en plass senere.
                </span>
                <div className="flex items-center gap-4">
                    {checkbox}
                    <RulesLink />
                </div>
            </AlertDescription>
        </Alert>
    );
}

function RulesLink() {
    return (
        <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
                <a
                    href={EVENT_RULES_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                />
            }
        >
            Les reglene
        </Button>
    );
}
