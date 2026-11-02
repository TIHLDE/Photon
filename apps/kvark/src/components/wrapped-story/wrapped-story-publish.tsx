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
import { ToggleGroup, ToggleGroupItem } from "@tihlde/ui/ui/toggle-group";
import {
    Eye,
    EyeOff,
    GalleryHorizontal,
    GalleryVertical,
    Send,
} from "lucide-react";
import { type ReactElement, useState } from "react";

import { formatInOslo } from "#/lib/date";

export type WrappedStoryLayout = "feed" | "cards";

const LAYOUTS: {
    value: WrappedStoryLayout;
    label: string;
    icon: typeof Eye;
}[] = [
    { value: "feed", label: "Rull opp og ned", icon: GalleryVertical },
    { value: "cards", label: "Sveip kort til siden", icon: GalleryHorizontal },
];

type WrappedStoryPublishProps = {
    layout: WrappedStoryLayout;
    isSavingLayout: boolean;
    onLayoutChange: (layout: WrappedStoryLayout) => void;
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
    layout,
    isSavingLayout,
    onLayoutChange,
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
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <p
                        id="wrapped-story-layout"
                        className="text-sm font-medium"
                    >
                        Visning
                    </p>
                    <ToggleGroup
                        variant="choice"
                        size="lg"
                        spacing={2}
                        value={[layout]}
                        disabled={isSavingLayout}
                        onValueChange={(next) => {
                            const picked = next[0];
                            if (picked === "feed" || picked === "cards") {
                                onLayoutChange(picked);
                            }
                        }}
                        aria-labelledby="wrapped-story-layout"
                        className="flex-wrap"
                    >
                        {LAYOUTS.map(({ value, label, icon: Icon }) => (
                            <ToggleGroupItem key={value} value={value}>
                                <Icon />
                                {label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <p className="text-sm text-muted-foreground">
                        {layout === "cards"
                            ? "Bildene ligger i en bunke. Sveip til høyre for neste, til venstre for forrige."
                            : "Bildene fyller skjermen. Sveip opp for neste, ned for forrige."}
                    </p>
                </div>
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
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
