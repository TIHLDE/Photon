import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { SmilePlus } from "lucide-react";
import { Suspense, lazy } from "react";

// Pickeren tar med seg hele emoji-datasettet. Den lastes først når noen
// faktisk åpner dialogen, så arrangementssiden ikke betaler for den.
const EmojiPicker = lazy(() => import("./emoji-picker"));

type ReactionPickerDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    theme: "light" | "dark";
    disabled: boolean;
    onPick: (emoji: string) => void;
};

export function ReactionPickerDialog({
    open,
    onOpenChange,
    theme,
    disabled,
    onPick,
}: ReactionPickerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Reager"
                        disabled={disabled}
                    />
                }
            >
                <SmilePlus />
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Reager</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center">
                    <Suspense fallback={<Spinner />}>
                        <EmojiPicker
                            theme={theme}
                            onPick={(emoji) => {
                                // Et dobbelttrykk mens forrige valg fortsatt
                                // er på vei skal ikke sende et nytt kall som
                                // kan komme fram i feil rekkefølge.
                                if (disabled) return;
                                onPick(emoji);
                            }}
                        />
                    </Suspense>
                </div>
            </DialogContent>
        </Dialog>
    );
}
