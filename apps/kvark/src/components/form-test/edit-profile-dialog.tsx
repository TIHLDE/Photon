import { formHandlers, useAppForm } from "#/hooks/form";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { FieldContent, FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";

const STUDY_PROGRAMS = [
    "dataing",
    "digfor",
    "digsam",
    "drift",
    "infobi",
] as const;

const STUDY_PROGRAM_LABELS: Record<(typeof STUDY_PROGRAMS)[number], string> = {
    dataing: "Dataingeniør",
    digfor: "Digital forretningsutvikling",
    digsam: "Digital samhandling",
    drift: "Drift",
    infobi: "Informasjonsbehandling",
};

const STUDY_YEARS = [
    { value: "1", label: "1. klasse" },
    { value: "2", label: "2. klasse" },
    { value: "3", label: "3. klasse" },
    { value: "4", label: "4. klasse" },
    { value: "5", label: "5. klasse" },
];

const ALLERGY_OPTIONS = [
    "Gluten",
    "Laktose",
    "Nøtter",
    "Egg",
    "Fisk",
    "Skalldyr",
    "Soya",
    "Vegetar",
    "Vegan",
];

const schema = z.object({
    firstName: z.string().min(1, { error: "Skriv inn fornavn" }),
    lastName: z.string().min(1, { error: "Skriv inn etternavn" }),
    bio: z.string().max(500, { error: "Maks 500 tegn" }),
    studyProgram: z
        .string()
        .nullable()
        .refine((v) => v !== null && v.length > 0, {
            error: "Velg studieprogram",
        }),
    studyYear: z
        .union([z.literal(""), z.enum(["1", "2", "3", "4", "5"])])
        .refine((v) => v !== "", { error: "Velg klassetrinn" }),
    allergies: z.array(z.string()),
    avatar: z.instanceof(File).nullable(),
    emailNotifications: z.boolean(),
});

interface EditProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({
    open,
    onOpenChange,
}: EditProfileDialogProps) {
    const form = useAppForm({
        defaultValues: {
            firstName: "Iver",
            lastName: "Lindholm",
            bio: "",
            studyProgram: null as string | null,
            studyYear: "3" as "" | "1" | "2" | "3" | "4" | "5",
            allergies: [] as string[],
            avatar: null as File | null,
            emailNotifications: true,
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Update profile:", value);
            onOpenChange(false);
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) form.reset();
                onOpenChange(o);
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rediger profil</DialogTitle>
                    <DialogDescription>
                        Endringer lagres på din TIHLDE-profil.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="avatar">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Profilbilde</field.Label>
                                    <field.ImageDropzone
                                        maxSize={2 * 1024 * 1024}
                                    />
                                    <field.Description>
                                        Bilde, maks 2 MB
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <div className="grid grid-cols-2 gap-3">
                            <form.AppField name="firstName">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Fornavn</field.Label>
                                        <field.Input autoComplete="given-name" />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                            <form.AppField name="lastName">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Etternavn</field.Label>
                                        <field.Input autoComplete="family-name" />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </div>
                        <form.AppField name="studyProgram">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Studieprogram</field.Label>
                                    <field.Combobox
                                        items={STUDY_PROGRAMS}
                                        placeholder="Søk etter program..."
                                        getLabel={(id) =>
                                            STUDY_PROGRAM_LABELS[id]
                                        }
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="studyYear">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Klassetrinn</field.Label>
                                    <field.Select
                                        options={STUDY_YEARS}
                                        placeholder="Velg klassetrinn"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="bio">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Om meg</field.Label>
                                    <field.Textarea
                                        rows={3}
                                        placeholder="Fortell litt om deg selv..."
                                    />
                                    <field.Description>
                                        Vises på din offentlige profil
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="allergies">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Allergier</field.Label>
                                    <field.Combobox
                                        items={ALLERGY_OPTIONS}
                                        multi
                                        placeholder="Legg til allergi..."
                                    />
                                    <field.Description>
                                        Brukes ved arrangementspåmelding
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="emailNotifications">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <FieldContent>
                                        <field.Label>E-postvarsler</field.Label>
                                        <field.Description>
                                            Få e-post om nye arrangementer og
                                            annonser
                                        </field.Description>
                                    </FieldContent>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <form.AppForm>
                            <form.SubmitButton
                                loading={
                                    <>
                                        <Spinner />
                                        <span>Lagrer...</span>
                                    </>
                                }
                            >
                                Lagre endringer
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
