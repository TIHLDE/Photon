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
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";

const CATEGORIES = [
    { value: "social", label: "Sosialt" },
    { value: "academic", label: "Faglig" },
    { value: "career", label: "Karriere" },
    { value: "other", label: "Annet" },
];

const schema = z.object({
    title: z.string().min(3, { error: "Minst 3 tegn" }).max(80, {
        error: "Maks 80 tegn",
    }),
    description: z
        .string()
        .min(10, { error: "Minst 10 tegn" })
        .max(2000, { error: "Maks 2000 tegn" }),
    category: z
        .union([
            z.literal(""),
            z.enum(["social", "academic", "career", "other"]),
        ])
        .refine((v) => v !== "", { error: "Velg en kategori" }),
    maxParticipants: z
        .number()
        .int()
        .min(1, { error: "Minst 1" })
        .max(500, { error: "Maks 500" })
        .nullable(),
    image: z.instanceof(File).nullable(),
});

interface CreateEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({
    open,
    onOpenChange,
}: CreateEventDialogProps) {
    const form = useAppForm({
        defaultValues: {
            title: "",
            description: "",
            category: "" as "" | "social" | "academic" | "career" | "other",
            maxParticipants: null as number | null,
            image: null as File | null,
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Create event:", value);
            onOpenChange(false);
            form.reset();
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
                    <DialogTitle>Nytt arrangement</DialogTitle>
                    <DialogDescription>
                        Fyll ut detaljer for å publisere arrangementet.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="title">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Tittel</field.Label>
                                    <field.Input placeholder="F.eks. Bedriftspresentasjon" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="category">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Kategori</field.Label>
                                    <field.Select
                                        options={CATEGORIES}
                                        placeholder="Velg kategori"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="description">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Beskrivelse</field.Label>
                                    <field.Textarea
                                        rows={4}
                                        placeholder="Hva skjer på arrangementet?"
                                    />
                                    <field.Description>
                                        Markdown støttes
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="maxParticipants">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Maks deltakere</field.Label>
                                    <field.Number
                                        min={1}
                                        max={500}
                                        placeholder="50"
                                    />
                                    <field.Description>
                                        La stå tom for ingen grense
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="image">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Coverbilde</field.Label>
                                    <field.ImageDropzone
                                        maxSize={5 * 1024 * 1024}
                                    />
                                    <field.Description>
                                        Bilde, maks 5 MB
                                    </field.Description>
                                    <field.Error />
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
                                        <span>Oppretter...</span>
                                    </>
                                }
                            >
                                Opprett arrangement
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
