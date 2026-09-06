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

        // Via /koble-feide fordi syncFeideHook bare kjører når callbacken
        // minter en ny sesjon — den som allerede er innlogget kan havne i
        // lenkegrenen, som ikke gjør det. Den siden kaller synken eksplisitt.
        const next =
            router.state.location.pathname + router.state.location.searchStr;
        void signInWithFeide(
            `/koble-feide?linked=1&next=${encodeURIComponent(next)}`,
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
