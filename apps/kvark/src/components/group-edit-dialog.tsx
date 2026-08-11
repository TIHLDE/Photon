import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
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
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Separator } from "@tihlde/ui/ui/separator";
import { Switch } from "@tihlde/ui/ui/switch";
import { RichEditor } from "@tihlde/ui/complex/markdown";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { richRegistry } from "#/components/markdown/directives/presets";
import {
    MemberSingleCombobox,
    type ComboboxMember,
} from "#/components/user-combobox";
import type { Group } from "#/lib/group";

export type GroupEditValues = {
    name: string;
    description: string;
    contactEmail: string;
    finesActivated: boolean;
    finesAdminId: string | null;
    finesInfo: string;
};

type GroupEditDialogProps = {
    group: Group;
    /** Gruppens medlemmer — botsjefen må være en av dem. */
    members: ComboboxMember[];
    onSubmit: (values: GroupEditValues) => void;
    isSubmitting?: boolean;
    error?: string | null;
};

export function GroupEditDialog({
    group,
    members,
    onSubmit,
    isSubmitting,
    error,
}: GroupEditDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description);
    const [contactEmail, setContactEmail] = useState(group.contactEmail);
    const [finesActivated, setFinesActivated] = useState(
        group.finesActivated ?? false,
    );
    const [finesAdmin, setFinesAdmin] = useState<ComboboxMember | null>(null);
    const [finesInfo, setFinesInfo] = useState(group.finesInfo ?? "");

    // Dialogen blir stående montert, så feltene må hentes inn på nytt hver
    // gang den åpnes — ellers viser den det du skrev og angret på sist.
    useEffect(() => {
        if (!open) return;
        setName(group.name);
        setDescription(group.description);
        setContactEmail(group.contactEmail);
        setFinesActivated(group.finesActivated ?? false);
        setFinesInfo(group.finesInfo ?? "");
        setFinesAdmin(
            members.find((member) => member.id === group.finesAdminId) ?? null,
        );
    }, [open, group, members]);

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        onSubmit({
            name: name.trim(),
            description,
            contactEmail: contactEmail.trim(),
            finesActivated,
            finesAdminId: finesAdmin?.id ?? null,
            finesInfo,
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button variant="outline">
                        <Pencil />
                        Rediger gruppe
                    </Button>
                }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Rediger gruppen</DialogTitle>
                    <DialogDescription>
                        Endringene lagres når du trykker «Oppdater».
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="group-edit-form"
                    className="flex flex-col gap-4"
                    onSubmit={handleSubmit}
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="group-name">
                                Gruppenavn *
                            </FieldLabel>
                            <Input
                                id="group-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel id="group-description-label">
                                Gruppebeskrivelse
                            </FieldLabel>
                            <RichEditor
                                registry={richRegistry}
                                value={description}
                                onChange={setDescription}
                                ariaLabelledBy="group-description-label"
                            />
                            <FieldDescription>
                                Vises på «Om»-fanen til gruppen.
                            </FieldDescription>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="group-email">
                                Kontakt e-post
                            </FieldLabel>
                            <Input
                                id="group-email"
                                type="email"
                                value={contactEmail}
                                onChange={(e) =>
                                    setContactEmail(e.target.value)
                                }
                            />
                        </Field>

                        <Separator />

                        <h3 className="text-sm font-medium">Botsystem</h3>
                        <Field orientation="horizontal">
                            <FieldLabel htmlFor="fines-activated">
                                Botsystem på
                            </FieldLabel>
                            <Switch
                                id="fines-activated"
                                checked={finesActivated}
                                onCheckedChange={setFinesActivated}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Botsjef</FieldLabel>
                            <MemberSingleCombobox
                                items={members}
                                value={finesAdmin}
                                onValueChange={setFinesAdmin}
                                placeholder="Søk blant medlemmene"
                            />
                        </Field>
                        <Field>
                            <FieldLabel id="fines-info-label">
                                Botsystem: praktiske detaljer
                            </FieldLabel>
                            <RichEditor
                                registry={richRegistry}
                                value={finesInfo}
                                onChange={setFinesInfo}
                                ariaLabelledBy="fines-info-label"
                            />
                            <FieldDescription>
                                Vises øverst på bøter-fanen.
                            </FieldDescription>
                        </Field>
                    </FieldGroup>
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                </form>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        type="submit"
                        form="group-edit-form"
                        disabled={isSubmitting || name.trim().length === 0}
                    >
                        {isSubmitting ? "Lagrer …" : "Oppdater"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
