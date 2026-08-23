import { useForm } from "@tanstack/react-form";
import {
    AvatarCropper,
    type AvatarCropperHandle,
} from "@tihlde/ui/ui/avatar-cropper";
import {
    AvatarPicker,
    type AvatarPickerHandle,
} from "@tihlde/ui/ui/avatar-picker";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { ImageUp, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { avatarImageUrl } from "#/lib/assets";
import { initials } from "#/lib/utils";

const BIO_MAX = 500;

/** Bildet beskjæres i nettleseren, så grensa gjelder fila som velges. */
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/** Tomt felt betyr «fjern lenken», alt annet må være en gyldig URL. */
const linkField = z.union([
    z.url({ message: "Må være en gyldig URL" }),
    z.literal(""),
]);

const editProfileSchema = z.object({
    bio: z.string().max(BIO_MAX, `Maks ${BIO_MAX} tegn`),
    github: linkField,
    linkedin: linkField,
});

type EditProfileValues = z.infer<typeof editProfileSchema>;

export type EditProfileSubmitValues = EditProfileValues & {
    /** Ferdig beskåret kvadratisk bilde, eller `null` når det ikke ble byttet. */
    imageFile: File | null;
    /** Sant når medlemmet fjernet sitt eget bilde. */
    removeImage: boolean;
};

type EditProfileDialogProps = {
    defaultValues?: Partial<EditProfileValues>;
    /** Brukes til initialer i fallbacken og som alt-tekst. */
    name: string;
    /** Bildet som vises i dag — enten det opplastede eller det fra Feide. */
    imageUrl?: string | null;
    /**
     * Sant når medlemmet har lastet opp sitt eget bilde. Bare da gir «Fjern
     * bilde» mening: Feide-bildet er ikke vårt å slette, og det er nettopp
     * det profilen faller tilbake til.
     */
    hasCustomImage?: boolean;
    onSubmit?: (values: EditProfileSubmitValues) => void | Promise<void>;
    /**
     * Styrt åpen-tilstand. Oppgis denne, skjules den innebygde
     * «Rediger profil»-knappen og kalleren bestemmer når dialogen vises — slik
     * kan flere knapper (f.eks. «Legg til lenke») åpne samme dialog.
     */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export function EditProfileDialog({
    defaultValues,
    name,
    imageUrl,
    hasCustomImage = false,
    onSubmit,
    open: controlledOpen,
    onOpenChange,
}: EditProfileDialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    function setOpen(next: boolean) {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
    }

    const bio = defaultValues?.bio ?? "";
    const github = defaultValues?.github ?? "";
    const linkedin = defaultValues?.linkedin ?? "";

    // Bildet lever utenfor skjemaet: det er en fil som skal lastes opp, ikke
    // et felt som sendes med JSON-en.
    const [croppedImage, setCroppedImage] = useState<File | null>(null);
    const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);
    /** Fila som beskjæres nå. Er den satt, viser dialogen beskjæringen. */
    const [cropSource, setCropSource] = useState<File | null>(null);

    const form = useForm({
        defaultValues: { bio, github, linkedin } satisfies EditProfileValues,
        validators: { onChange: editProfileSchema },
        onSubmit: async ({ value }) => {
            await onSubmit?.({
                ...value,
                imageFile: croppedImage,
                removeImage,
            });
            setOpen(false);
        },
    });

    // Dialogen monteres én gang og beholder skjemastaten sin, så feltene må
    // fylles på nytt hver gang den åpnes — ellers viser den verdiene fra da
    // komponenten ble montert, ikke de sist lagrede.
    useEffect(() => {
        if (open) form.reset({ bio, github, linkedin });
    }, [open, bio, github, linkedin, form]);

    // Samme gjelder bildet: et påbegynt, men forkastet, bildebytte skal ikke
    // ligge igjen til neste gang dialogen åpnes.
    useEffect(() => {
        if (open) return;
        setCroppedImage(null);
        setRemoveImage(false);
        setImageError(null);
        setCropSource(null);
    }, [open]);

    useEffect(() => {
        if (!croppedImage) {
            setCroppedPreview(null);
            return;
        }
        const url = URL.createObjectURL(croppedImage);
        setCroppedPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [croppedImage]);

    function pickFile(file: File | null | undefined) {
        setImageError(null);
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setImageError("Filen må være et bilde.");
            return;
        }
        if (file.size > IMAGE_MAX_BYTES) {
            setImageError(
                `Bildet er ${(file.size / 1024 / 1024).toFixed(1)} MB. Maks er ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
            );
            return;
        }

        setCropSource(file);
    }

    const previewUrl = croppedPreview
        ? croppedPreview
        : removeImage
          ? null
          : imageUrl
            ? avatarImageUrl(imageUrl)
            : null;

    // Etter beskjæring er det det nye bildet som kan angres; ellers er det
    // medlemmets eget opplastede bilde som kan fjernes.
    const canRemove = croppedImage !== null || (hasCustomImage && !removeImage);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {isControlled ? null : (
                <DialogTrigger
                    render={
                        <Button>
                            <Pencil />
                            Rediger profil
                        </Button>
                    }
                />
            )}
            <DialogContent className="max-w-lg">
                {cropSource ? (
                    <CropStep
                        file={cropSource}
                        onCancel={() => setCropSource(null)}
                        onDone={(file) => {
                            setCroppedImage(file);
                            setRemoveImage(false);
                            setCropSource(null);
                        }}
                    />
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Rediger profil</DialogTitle>
                            <DialogDescription>
                                Bildet og teksten andre ser på profilen din.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                form.handleSubmit();
                            }}
                            className="flex min-h-0 flex-auto flex-col gap-4"
                        >
                            <DialogBody>
                                <FieldGroup>
                                    <AvatarField
                                        name={name}
                                        previewUrl={previewUrl}
                                        canRemove={canRemove}
                                        error={imageError}
                                        onPick={pickFile}
                                        onRemove={() => {
                                            // Et nytt bilde angres tilbake til
                                            // det som allerede lå der; er det
                                            // ingenting nytt, fjernes bildet.
                                            if (croppedImage) {
                                                setCroppedImage(null);
                                            } else {
                                                setRemoveImage(true);
                                            }
                                            setImageError(null);
                                        }}
                                    />

                                    <form.Field name="bio">
                                        {(field) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    Beskrivelse
                                                </FieldLabel>
                                                <Textarea
                                                    id={field.name}
                                                    name={field.name}
                                                    rows={4}
                                                    placeholder="Skriv her..."
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <FieldDescription>
                                                    Tegn igjen:{" "}
                                                    {Math.max(
                                                        0,
                                                        BIO_MAX -
                                                            (field.state.value
                                                                ?.length ?? 0),
                                                    )}
                                                </FieldDescription>
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            </Field>
                                        )}
                                    </form.Field>

                                    <form.Field name="github">
                                        {(field) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    GitHub
                                                </FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    placeholder="Skriv her..."
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <FieldDescription>
                                                    Din GitHub profil.
                                                </FieldDescription>
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            </Field>
                                        )}
                                    </form.Field>

                                    <form.Field name="linkedin">
                                        {(field) => (
                                            <Field>
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    LinkedIn
                                                </FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    placeholder="Skriv her..."
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <FieldDescription>
                                                    Din LinkedIn profil.
                                                </FieldDescription>
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            </Field>
                                        )}
                                    </form.Field>
                                </FieldGroup>
                            </DialogBody>
                            <DialogFooter>
                                <form.Subscribe
                                    selector={(state) => ({
                                        canSubmit: state.canSubmit,
                                        isSubmitting: state.isSubmitting,
                                    })}
                                >
                                    {({ canSubmit, isSubmitting }) => (
                                        <Button
                                            type="submit"
                                            disabled={!canSubmit}
                                        >
                                            {isSubmitting
                                                ? croppedImage
                                                    ? "Laster opp …"
                                                    : "Lagrer …"
                                                : "Lagre"}
                                        </Button>
                                    )}
                                </form.Subscribe>
                            </DialogFooter>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AvatarField({
    name,
    previewUrl,
    canRemove,
    error,
    onPick,
    onRemove,
}: {
    name: string;
    previewUrl: string | null;
    canRemove: boolean;
    error: string | null;
    onPick: (file: File | undefined) => void;
    onRemove: () => void;
}) {
    const pickerRef = useRef<AvatarPickerHandle>(null);

    return (
        <Field>
            <FieldLabel>Profilbilde</FieldLabel>
            <div className="flex items-center gap-4">
                {/* Selve bildet er velgeren: det er der blikket allerede er,
                    og det viser resultatet i samme sirkel som profilen. */}
                <AvatarPicker
                    controlRef={pickerRef}
                    src={previewUrl}
                    alt={name}
                    fallback={initials(name)}
                    onSelect={onPick}
                    labels={{
                        change: "Bytt profilbilde",
                        upload: "Last opp profilbilde",
                    }}
                />

                <div className="flex min-w-0 flex-col items-start gap-2">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => pickerRef.current?.open()}
                        >
                            <ImageUp />
                            {previewUrl ? "Bytt bilde" : "Last opp bilde"}
                        </Button>
                        {canRemove ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onRemove}
                            >
                                <Trash2 />
                                Fjern
                            </Button>
                        ) : null}
                    </div>
                    <FieldDescription>
                        Vises i en sirkel. Du beskjærer bildet selv i neste
                        steg.
                    </FieldDescription>
                </div>
            </div>

            <FieldError errors={error ? [{ message: error }] : undefined} />
        </Field>
    );
}

function CropStep({
    file,
    onCancel,
    onDone,
}: {
    file: File;
    onCancel: () => void;
    onDone: (file: File) => void;
}) {
    const cropperRef = useRef<AvatarCropperHandle>(null);
    const [isReady, setIsReady] = useState(false);
    const [isCropping, setIsCropping] = useState(false);

    async function confirm() {
        setIsCropping(true);
        try {
            const cropped = await cropperRef.current?.getCroppedFile();
            if (cropped) onDone(cropped);
        } finally {
            setIsCropping(false);
        }
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>Beskjær profilbildet</DialogTitle>
                <DialogDescription>
                    Sirkelen er utsnittet som vises på profilen din.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <AvatarCropper
                    controlRef={cropperRef}
                    file={file}
                    onReadyChange={setIsReady}
                />
            </DialogBody>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Avbryt
                </Button>
                <Button
                    type="button"
                    onClick={confirm}
                    disabled={!isReady || isCropping}
                >
                    {isCropping ? "Beskjærer …" : "Bruk bilde"}
                </Button>
            </DialogFooter>
        </>
    );
}
