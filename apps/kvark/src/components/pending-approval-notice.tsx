import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Hourglass } from "lucide-react";

/**
 * Vises over hele appen til en bruker som har registrert seg selv og venter på
 * at en administrator godkjenner kontoen.
 *
 * Uten den ville ventetiden føltes som en feil: påmeldingsknappen mangler, og
 * medlemssidene er tomme, uten at noe forklarer hvorfor.
 */
export function PendingApprovalNotice() {
    return (
        <Alert>
            <Hourglass className="size-4" />
            <AlertTitle>Brukeren din venter på godkjenning</AlertTitle>
            <AlertDescription>
                Du kan se det alle andre ser. Når en administrator har godkjent
                deg, får du e-post og kan melde deg på arrangementer.
            </AlertDescription>
        </Alert>
    );
}
