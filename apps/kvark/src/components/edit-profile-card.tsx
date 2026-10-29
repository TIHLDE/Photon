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
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { convertHeicToJpeg, isHeicFile } from "@tihlde/ui/lib/heic";

import { formHandlers, useAppForm } from "#/hooks/form";
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

type EditProfileCardProps = {
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
};

export function EditProfileCard({
    defaultValues,
    name,
    imageUrl,
    hasCustomImage = false,
    onSubmit,
}: EditProfileCardProps) {
    const bio = defaultValues?.bio ?? "";
    const github = defaultValues?.github ?? "";
    const linkedin = defaultValues?.linkedin ?? "";

    // Bildet lever utenfor skjemaet: det er en fil som skal lastes opp, ikke
    // et felt som sendes med JSON-en.
    const [croppedImage, setCroppedImage] = useState<File | null>(null);
    const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);
    /** Fila som beskjæres nå. Er den satt, viser kortet beskjæringen. */
    const [cropSource, setCropSource] = useState<File | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    /** HEIC-konvertering tar et par sekunder, og skal ikke se ut som ingenting. */
    const [isConverting, setIsConverting] = useState(false);
    /** Uten en dialog som lukkes, er dette eneste tegn på at lagringen gikk. */
    const [justSaved, setJustSaved] = useState(false);

    const form = useAppForm({
        defaultValues: { bio, github, linkedin } satisfies EditProfileValues,
        validators: { onDynamic: editProfileSchema },
        onSubmit: async ({ value }) => {
            setSubmitError(null);
            setJustSaved(false);
            try {
                await onSubmit?.({
                    ...value,
                    imageFile: croppedImage,
                    removeImage,
                });
            } catch (error) {
                // Skjemaet blir stående med det medlemmet skrev, så de kan
                // prøve igjen. Uten dette så en feilet lagring ut som at
                // ingenting skjedde: knappen sluttet bare å gjøre noe.
                setSubmitError(
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke lagret endringene. Prøv igjen.",
                );
                return;
            }
            // Det som ble lagret, blir stående uten å regnes som endret.
            // Standardverdiene skal fortsatt komme fra sesjonen: overtok
            // skjemaet dem her, ville en feilet ny henting av sesjonen ført
            // de gamle verdiene tilbake i feltene ved neste render.
            form.reset(value, { keepDefaultValues: true });
            setCroppedImage(null);
            setRemoveImage(false);
            setImageError(null);
            setJustSaved(true);
        },
    });

    // Sesjonen lastes etter første render og hentes på nytt etter lagring, så
    // feltene må følge de lagrede verdiene — men aldri over noe medlemmet er i
    // ferd med å skrive.
    useEffect(() => {
        if (!form.state.isDirty) form.reset({ bio, github, linkedin });
    }, [bio, github, linkedin, form]);

    useEffect(() => {
        if (!croppedImage) {
            setCroppedPreview(null);
            return;
        }
        const url = URL.createObjectURL(croppedImage);
        setCroppedPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [croppedImage]);

    async function pickFile(file: File | null | undefined) {
        setImageError(null);
        if (!file) return;

        // HEIC-filer har ofte tom `type`, så formatsjekken må slippe dem
        // gjennom på filnavnet — ellers avvises iPhone-bilder som «ikke et
        // bilde».
        if (!file.type.startsWith("image/") && !isHeicFile(file)) {
            setImageError("Filen må være et bilde.");
            return;
        }
        if (file.size > IMAGE_MAX_BYTES) {
            setImageError(
                `Bildet er ${(file.size / 1024 / 1024).toFixed(1)} MB. Maks er ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
            );
            return;
        }

        // Beskjæringen viser bildet i en `<img>`, og hverken Chrome eller
        // Firefox kan dekode HEIC — så iPhone-bilder må konverteres først,
        // ellers møter medlemmet en tom ramme.
        if (isHeicFile(file)) {
            setIsConverting(true);
            try {
                setCropSource(await convertHeicToJpeg(file));
            } catch (error) {
                setImageError(
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke lest bildet. Prøv en annen fil.",
                );
            } finally {
                setIsConverting(false);
            }
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
    // Et påbegynt bildebytte er også en ulagret endring.
    const hasImageChange =
        croppedImage !== null || removeImage || cropSource !== null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>
                    Bildet og teksten andre ser på profilen din.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    {/* Feltene låses mens det lagres. Ellers nullstiller
                        lagringen det medlemmet rakk å endre i mellomtiden. */}
                    <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(isSubmitting) => (
                            <fieldset
                                disabled={isSubmitting}
                                className="min-w-0"
                            >
                                <FieldGroup>
                                    {cropSource ? (
                                        <CropField
                                            file={cropSource}
                                            onCancel={() => setCropSource(null)}
                                            onDone={(file) => {
                                                setCroppedImage(file);
                                                setRemoveImage(false);
                                                setCropSource(null);
                                                setJustSaved(false);
                                            }}
                                        />
                                    ) : (
                                        <AvatarField
                                            name={name}
                                            previewUrl={previewUrl}
                                            canRemove={canRemove}
                                            error={imageError}
                                            isConverting={isConverting}
                                            onPick={pickFile}
                                            onRemove={() => {
                                                // Et nytt bilde angres tilbake til det som
                                                // allerede lå der; er det ingenting nytt,
                                                // fjernes bildet.
                                                if (croppedImage) {
                                                    setCroppedImage(null);
                                                } else {
                                                    setRemoveImage(true);
                                                }
                                                setImageError(null);
                                                setJustSaved(false);
                                            }}
                                        />
                                    )}

                                    <form.AppField name="bio">
                                        {(field) => (
                                            <field.Field>
                                                <field.Label>
                                                    Beskrivelse
                                                </field.Label>
                                                <field.Textarea
                                                    rows={4}
                                                    placeholder="Skriv her..."
                                                />
                                                <field.Description>
                                                    Tegn igjen:{" "}
                                                    {Math.max(
                                                        0,
                                                        BIO_MAX -
                                                            field.state.value
                                                                .length,
                                                    )}
                                                </field.Description>
                                                <field.Error />
                                            </field.Field>
                                        )}
                                    </form.AppField>

                                    {/* Lenkene er korte felt og står side om side; på
                                    smale skjermer legger de seg under hverandre. */}
                                    <FieldGroup className="grid sm:grid-cols-2">
                                        <form.AppField name="github">
                                            {(field) => (
                                                <field.Field>
                                                    <field.Label>
                                                        GitHub
                                                    </field.Label>
                                                    <field.Input
                                                        type="url"
                                                        placeholder="Skriv her..."
                                                    />
                                                    <field.Description>
                                                        Din GitHub profil.
                                                    </field.Description>
                                                    <field.Error />
                                                </field.Field>
                                            )}
                                        </form.AppField>

                                        <form.AppField name="linkedin">
                                            {(field) => (
                                                <field.Field>
                                                    <field.Label>
                                                        LinkedIn
                                                    </field.Label>
                                                    <field.Input
                                                        type="url"
                                                        placeholder="Skriv her..."
                                                    />
                                                    <field.Description>
                                                        Din LinkedIn profil.
                                                    </field.Description>
                                                    <field.Error />
                                                </field.Field>
                                            )}
                                        </form.AppField>
                                    </FieldGroup>
                                </FieldGroup>
                            </fieldset>
                        )}
                    </form.Subscribe>

                    <FieldError
                        errors={
                            submitError ? [{ message: submitError }] : undefined
                        }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <form.AppForm>
                            <form.SubmitButton
                                // Lagre venter til beskjæringen er ferdig,
                                // ellers sendes det gamle bildet.
                                disabled={cropSource !== null}
                                loading={
                                    croppedImage ? "Laster opp …" : "Lagrer …"
                                }
                            >
                                Lagre profil
                            </form.SubmitButton>
                        </form.AppForm>
                        <form.Subscribe selector={(state) => state.isDirty}>
                            {(isDirty) =>
                                justSaved && !isDirty && !hasImageChange ? (
                                    <p
                                        role="status"
                                        className="text-sm text-muted-foreground"
                                    >
                                        Endringene er lagret.
                                    </p>
                                ) : null
                            }
                        </form.Subscribe>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function AvatarField({
    name,
    previewUrl,
    canRemove,
    error,
    isConverting,
    onPick,
    onRemove,
}: {
    name: string;
    previewUrl: string | null;
    canRemove: boolean;
    error: string | null;
    isConverting: boolean;
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
                    disabled={isConverting}
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
                            disabled={isConverting}
                            onClick={() => pickerRef.current?.open()}
                        >
                            <ImageUp />
                            {isConverting
                                ? "Åpner bildet …"
                                : previewUrl
                                  ? "Bytt bilde"
                                  : "Last opp bilde"}
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
                        Vises i en sirkel. Du beskjærer bildet selv etter at du
                        har valgt det.
                    </FieldDescription>
                </div>
            </div>

            <FieldError errors={error ? [{ message: error }] : undefined} />
        </Field>
    );
}

/** Beskjæringen tar plassen til bildefeltet til medlemmet er ferdig. */
function CropField({
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
        <Field>
            <FieldLabel>Beskjær profilbildet</FieldLabel>
            <FieldDescription>
                Sirkelen er utsnittet som vises på profilen din.
            </FieldDescription>
            <div className="w-full max-w-sm">
                <AvatarCropper
                    controlRef={cropperRef}
                    file={file}
                    onReadyChange={setIsReady}
                />
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
        </Field>
    );
}
