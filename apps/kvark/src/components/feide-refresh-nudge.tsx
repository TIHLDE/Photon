import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { signInWithFeide } from "#/api/auth";
import { useFeideRefreshPrompt } from "#/hooks/use-feide-refresh-prompt";

type FeideRefreshNudgeProps = {
    eventId: string;
    /** Om arrangementet i det hele tatt prioriterer noen. */
    hasPriority: boolean;
};

/**
 * Ber medlemmet bekrefte studiet sitt med Feide på et arrangement som
 * prioriterer.
 *
 * Prioriteringen leser studiegruppa, og den gruppa fjernes aldri av seg selv.
 * Har du byttet studium eller blitt ferdig, står den til du logger inn med
 * Feide igjen — og da er det din egen plass, eller noen andres, som avhenger av
 * et svar som er over et semester gammelt.
 *
 * Ingenting tas fra noen her. Vi ber, vi krever ikke: en utdatert bekreftelse
 * er ikke bevis for at noe er galt, og å sperre påmeldingen på den ville
 * rammet alle som bare ikke har logget inn på en stund.
 */
export function FeideRefreshNudge({
    eventId,
    hasPriority,
}: FeideRefreshNudgeProps) {
    const { showFeideRefreshPrompt, dismissFeideRefreshPrompt } =
        useFeideRefreshPrompt(eventId, hasPriority);
    const router = useRouter();
    const [isSigningIn, setIsSigningIn] = useState(false);

    if (!showFeideRefreshPrompt) return null;

    const signIn = () => {
        setIsSigningIn(true);
        // Tilbake hit etterpå: den som blir sendt til forsiden må finne fram
        // igjen selv, og da er poenget med å bekrefte studiet borte.
        void signInWithFeide(
            router.state.location.pathname + router.state.location.searchStr,
        ).catch(() => setIsSigningIn(false));
    };

    return (
        <Alert>
            <GraduationCap />
            <AlertTitle>Bekreft studiet ditt</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
                <span>
                    Dette arrangementet prioriterer etter studie, og vi har ikke
                    hørt fra Feide om ditt på over et semester. Logg inn med
                    Feide, så er vi sikre på at du står riktig.
                </span>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        onClick={signIn}
                        disabled={isSigningIn}
                    >
                        {isSigningIn
                            ? "Sender deg til Feide..."
                            : "Logg inn med Feide"}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={dismissFeideRefreshPrompt}
                    >
                        Ikke nå
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
