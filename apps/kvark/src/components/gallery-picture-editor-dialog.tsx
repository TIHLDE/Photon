import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { assetImageUrl } from "#/lib/assets";

export type PictureEditorValues = {
    title: string;
    description: string;
    imageAlt: string;
};

export type EditablePicture = {
    id: string;
    imageUrl: string;
    title?: string | null;
    description?: string | null;
    imageAlt?: string | null;
};

type GalleryPictureEditorDialogProps = {
    open: boolean;
    picture: EditablePicture | null;
    canDelete: boolean;
    isSaving: boolean;
    isDeleting: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (values: PictureEditorValues) => void;
    onDelete: () => void;
};

/**
 * Rediger tittel, beskrivelse og bildetekst på ett bilde, eller slett det.
 *
 * Sletting bekreftes i selve dialogen i stedet for i en `AlertDialog`: denne
 * dialogen åpnes fra lightboxen, og et tredje dialoglag oppå det ville stablet
 * to fokusfeller på hverandre.
 */
export function GalleryPictureEditorDialog({
    open,
    picture,
    canDelete,
    isSaving,
    isDeleting,
    error,
    onClose,
    onSubmit,
    onDelete,
}: GalleryPictureEditorDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [imageAlt, setImageAlt] = useState("");
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Fyll feltene på nytt hver gang dialogen åpnes for et (nytt) bilde.
    useEffect(() => {
        if (!open) return;
        setTitle(picture?.title ?? "");
        setDescription(picture?.description ?? "");
        setImageAlt(picture?.imageAlt ?? "");
        setConfirmingDelete(false);
    }, [open, picture]);

    const busy = isSaving || isDeleting;

    function handleSubmit() {
        if (busy) return;
        onSubmit({
            title: title.trim(),
            description: description.trim(),
            imageAlt: imageAlt.trim(),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Rediger bilde</DialogTitle>
                    <DialogDescription>
                        Endre tittel, beskrivelse og bildetekst.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    {picture ? (
                        <img
                            src={assetImageUrl(picture.imageUrl, 480)}
                            alt={picture.imageAlt ?? picture.title ?? ""}
                            decoding="async"
                            className="max-h-48 w-full object-contain"
                        />
                    ) : null}

                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmit();
                        }}
                    >
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="picture-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="picture-title"
                                    value={title}
                                    maxLength={100}
                                    placeholder="Skriv her..."
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="picture-description">
                                    Beskrivelse
                                </FieldLabel>
                                <Textarea
                                    id="picture-description"
                                    rows={3}
                                    value={description}
                                    maxLength={5000}
                                    placeholder="Skriv her..."
                                    onChange={(e) =>
                                        setDescription(e.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="picture-alt">
                                    Bildetekst
                                </FieldLabel>
                                <Input
                                    id="picture-alt"
                                    value={imageAlt}
                                    maxLength={200}
                                    placeholder="Skriv her..."
                                    onChange={(e) =>
                                        setImageAlt(e.target.value)
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Beskriver bildet for skjermlesere og vises
                                    hvis bildet ikke lastes.
                                </p>
                            </Field>
                        </FieldGroup>
                    </form>

                    {error ? (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke lagre</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                </DialogBody>
                {confirmingDelete ? (
                    <DialogFooter>
                        <p className="mr-auto text-sm text-muted-foreground">
                            Slette bildet permanent?
                        </p>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirmingDelete(false)}
                        >
                            Avbryt
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={onDelete}
                        >
                            {isDeleting ? "Sletter..." : "Slett bildet"}
                        </Button>
                    </DialogFooter>
                ) : (
                    <DialogFooter>
                        {canDelete ? (
                            <Button
                                variant="destructive"
                                className="mr-auto"
                                disabled={busy}
                                onClick={() => setConfirmingDelete(true)}
                            >
                                Slett bilde
                            </Button>
                        ) : null}
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Avbryt
                        </Button>
                        <Button disabled={busy} onClick={handleSubmit}>
                            {isSaving ? "Lagrer..." : "Lagre"}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
