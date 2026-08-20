import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Link } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";

type AllergyPromptProps = {
    /** Kalles når medlemmet velger å skjule oppfordringen. */
    onDismiss: () => void;
};

/**
 * Ber medlemmet oppgi allergier når de nettopp har fått plass.
 *
 * Her, og ikke bare på profilen, fordi det er nå det er relevant: arrangøren
 * bestiller maten etter påmeldingslista, og folk går ikke innom innstillingene
 * uoppfordret. Vises kun til dem som aldri har svart — har man svart «ingen
 * allergier», er man ferdig med spørsmålet.
 */
export function AllergyPrompt({ onDismiss }: AllergyPromptProps) {
    return (
        <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Har du allergier?</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
                <span>
                    Arrangøren bruker dette når de bestiller mat. Har du ingen,
                    sier du fra om det samme sted.
                </span>
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        render={
                            <Link
                                to="/profil/$id/innstillinger"
                                params={{ id: "me" }}
                            />
                        }
                    >
                        Legg inn allergier
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDismiss}>
                        Ikke nå
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
