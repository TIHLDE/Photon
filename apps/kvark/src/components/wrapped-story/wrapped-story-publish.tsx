import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@tihlde/ui/ui/alert-dialog";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Eye, EyeOff, Send } from "lucide-react";
import { type ReactElement, useState } from "react";

import { formatInOslo } from "#/lib/date";

type WrappedStoryPublishProps = {
    selectedCount: number;
    publishedAt: string | null;
    firstPublishedAt: string | null;
    isPending: boolean;
    error: string | null;
    /** Lenken til storyen, f.eks. en `<Link>`. */
    storyLink: ReactElement;
    onPublish: () => void;
    onUnpublish: () => void;
};

type Confirm = "publish" | "unpublish" | null;

/**
 * Organisatorens publisering av storyen: av eller på, med en bekreftelse
 * før hvert av dem. Hver publisering varsler deltakerne, og avpublisering
 * sletter varslene igjen.
 */
export function WrappedStoryPublish({
    selectedCount,
    publishedAt,
    firstPublishedAt,
    isPending,
    error,
    storyLink,
    onPublish,
    onUnpublish,
}: WrappedStoryPublishProps) {
    const [confirm, setConfirm] = useState<Confirm>(null);
    const isPublished = publishedAt !== null;
    const publishedBefore = firstPublishedAt !== null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Story</CardTitle>
                <CardDescription>
                    {isPublished
                        ? `Publisert ${formatInOslo(publishedAt, "d. MMM yyyy 'kl.' HH:mm")}. Endringer i utvalget vises i storyen med en gang.`
                        : "Bildene du velger blir storyen. Alle med TIHLDE-konto kan se den når den er publisert."}
                </CardDescription>
            </CardHeader>
            {error ? (
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            ) : null}
            <CardFooter className="flex flex-wrap gap-2">
                {isPublished ? (
                    <>
                        <Button render={storyLink}>
                            <Eye />
                            Se story
                        </Button>
                        <Button
                            variant="outline"
                            disabled={isPending}
                            onClick={() => setConfirm("unpublish")}
                        >
                            <EyeOff />
                            Avpubliser
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            disabled={isPending || selectedCount === 0}
                            onClick={() => setConfirm("publish")}
                        >
                            <Send />
                            Publiser
                        </Button>
                        {selectedCount > 0 ? (
                            <Button variant="outline" render={storyLink}>
                                <Eye />
                                Forhåndsvis
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Velg minst ett bilde først.
                            </p>
                        )}
                    </>
                )}
            </CardFooter>

            <AlertDialog
                open={confirm !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirm(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm === "unpublish"
                                ? "Avpubliser storyen?"
                                : publishedBefore
                                  ? "Publiser storyen igjen?"
                                  : "Publiser storyen?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm === "unpublish"
                                ? "Storyen blir borte for medlemmene, og varslene om den slettes. Likes og kommentarer blir liggende og kommer tilbake om du publiserer igjen."
                                : `${selectedCount === 1 ? "1 bilde" : `${selectedCount} bilder`} blir synlige for alle med TIHLDE-konto. Alle som var påmeldt får et varsel.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel variant="outline" size="default">
                            Avbryt
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant={
                                confirm === "unpublish"
                                    ? "destructive"
                                    : "default"
                            }
                            disabled={isPending}
                            onClick={() => {
                                if (confirm === "unpublish") onUnpublish();
                                else onPublish();
                                setConfirm(null);
                            }}
                        >
                            {confirm === "unpublish"
                                ? "Avpubliser"
                                : "Publiser"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
