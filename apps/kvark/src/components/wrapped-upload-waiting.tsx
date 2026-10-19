import { Alert, AlertAction, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { WifiOff } from "lucide-react";

/**
 * Photos that are taken but could not be uploaded yet. They stay on the
 * phone and go up on their own when the network is back; the button is for
 * those who do not want to wait for the browser to notice.
 */
export function WrappedUploadWaiting({
    count,
    onRetry,
}: {
    count: number;
    onRetry: () => void;
}) {
    return (
        <Alert variant="warning">
            <WifiOff />
            <AlertTitle>
                {count} {count === 1 ? "bilde venter" : "bilder venter"} på nett
            </AlertTitle>
            <AlertAction className="top-1/2 -translate-y-1/2">
                <Button size="sm" variant="outline" onClick={onRetry}>
                    Prøv igjen
                </Button>
            </AlertAction>
        </Alert>
    );
}
