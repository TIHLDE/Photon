import { Button } from "@tihlde/ui/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@tihlde/ui/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { QRCode } from "@tihlde/ui/ui/qr-code";
import { Download, Trash } from "lucide-react";
import { useRef } from "react";

type QRCodeCardProps = {
    name: string;
    content: string;
    deleting: boolean;
    onDelete: () => void;
};

export function QRCodeCard({
    name,
    content,
    deleting,
    onDelete,
}: QRCodeCardProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    function download() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `${name}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <QRCode ref={canvasRef} value={content} />

                <p className="text-sm break-all text-muted-foreground">
                    {content}
                </p>

                <div className="flex flex-col gap-2">
                    <Button type="button" onClick={download}>
                        <Download />
                        Last ned
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={deleting}
                                >
                                    <Trash />
                                    Slett QR kode
                                </Button>
                            }
                        />
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Er du sikker?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Denne QR koden vil ikke lenger være
                                    tilgjengelig for deg selv og andre.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel
                                    variant="outline"
                                    size="default"
                                >
                                    Avbryt
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={onDelete}
                                >
                                    Slett
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
