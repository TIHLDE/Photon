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

const TRANSPORT_OPTIONS = [
    { value: "own", label: "Egen bil" },
    { value: "carpool", label: "Vil sitte på" },
    { value: "transit", label: "Kollektiv" },
    { value: "walk", label: "Går / sykler" },
];

const schema = z
    .object({
        allergies: z.string().max(500, { error: "Maks 500 tegn" }),
        comment: z.string().max(500, { error: "Maks 500 tegn" }),
        transport: z
            .union([
                z.literal(""),
                z.enum(["own", "carpool", "transit", "walk"]),
            ])
            .refine((v) => v !== "", { error: "Velg transport" }),
        canDriveCount: z.number().int().min(0).max(8).nullable(),
        acceptTerms: z.boolean().refine((v) => v === true, {
            error: "Du må godta vilkårene",
        }),
    })
    .refine(
        (data) =>
            data.transport !== "own" ||
            (data.canDriveCount !== null && data.canDriveCount >= 0),
        {
            error: "Oppgi antall passasjerer",
            path: ["canDriveCount"],
        },
    );

interface EventRegistrationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventTitle: string;
}

export function EventRegistrationDialog({
    open,
    onOpenChange,
    eventTitle,
}: EventRegistrationDialogProps) {
    const form = useAppForm({
        defaultValues: {
            allergies: "",
            comment: "",
            transport: "" as "" | "own" | "carpool" | "transit" | "walk",
            canDriveCount: null as number | null,
            acceptTerms: false,
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Register for event:", value);
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Påmelding</DialogTitle>
                    <DialogDescription>
                        Du melder deg på <strong>{eventTitle}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="allergies">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Allergier</field.Label>
                                    <field.Textarea
                                        rows={2}
                                        placeholder="F.eks. nøtter, gluten..."
                                    />
                                    <field.Description>
                                        Henter fra profil hvis tom
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="transport">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Transport</field.Label>
                                    <field.Select
                                        options={TRANSPORT_OPTIONS}
                                        placeholder="Velg transport"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.Subscribe
                            selector={(state) => state.values.transport}
                        >
                            {(transport) =>
                                transport === "own" ? (
                                    <form.AppField name="canDriveCount">
                                        {(field) => (
                                            <field.Field required>
                                                <field.Label>
                                                    Ledige plasser
                                                </field.Label>
                                                <field.Number
                                                    min={0}
                                                    max={8}
                                                    placeholder="0"
                                                />
                                                <field.Description>
                                                    Hvor mange kan du ta med?
                                                </field.Description>
                                                <field.Error />
                                            </field.Field>
                                        )}
                                    </form.AppField>
                                ) : null
                            }
                        </form.Subscribe>
                        <form.AppField name="comment">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Kommentar</field.Label>
                                    <field.Textarea
                                        rows={3}
                                        placeholder="Valgfritt — synlig for arrangør"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="acceptTerms">
                            {(field) => (
                                <field.Field orientation="horizontal" required>
                                    <field.Checkbox />
                                    <FieldContent>
                                        <field.Label>
                                            Jeg godtar reglementet for
                                            arrangementer
                                        </field.Label>
                                        <field.Description>
                                            Inkluderer prikkregler ved no-show
                                        </field.Description>
                                        <field.Error />
                                    </FieldContent>
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
                                        <span>Melder på...</span>
                                    </>
                                }
                            >
                                Bekreft påmelding
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
