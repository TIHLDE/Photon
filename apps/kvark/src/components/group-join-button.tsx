import { Alert, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { CheckCircle2, TriangleAlert, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

type GroupJoinButtonProps = {
    groupName: string;
    onRequest: () => Promise<unknown>;
};

export function GroupJoinButton({
    groupName,
    onRequest,
}: GroupJoinButtonProps) {
    const [result, setResult] = useState<{ error?: string } | null>(null);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!result || result.error) return;
        const timer = setTimeout(() => setResult(null), 1000);
        return () => clearTimeout(timer);
    }, [result]);

    async function request() {
        setIsSending(true);
        try {
            await onRequest();
            setResult({});
        } catch (error) {
            setResult({
                error: error instanceof Error ? error.message : "Prøv igjen.",
            });
        } finally {
            setIsSending(false);
        }
    }

    return (
        <>
            <Button onClick={request} disabled={isSending}>
                <UserPlus />
                Bli med i denne interessegruppen
            </Button>
            <Dialog
                open={result !== null}
                onOpenChange={(open) => !open && setResult(null)}
            >
                <DialogContent showCloseButton={Boolean(result?.error)}>
                    <DialogHeader>
                        <DialogTitle>
                            Søk om å bli med i {groupName}
                        </DialogTitle>
                    </DialogHeader>
                    <Alert variant={result?.error ? "destructive" : "default"}>
                        {result?.error ? <TriangleAlert /> : <CheckCircle2 />}
                        <AlertTitle>
                            {result?.error ??
                                "Gruppeleder har blitt bedt om å legge deg til!"}
                        </AlertTitle>
                    </Alert>
                </DialogContent>
            </Dialog>
        </>
    );
}
