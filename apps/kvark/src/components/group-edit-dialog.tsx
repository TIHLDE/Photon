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
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Separator } from "@tihlde/ui/ui/separator";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { Pencil, X } from "lucide-react";

import type { Group } from "#/mock/group-detail";

type GroupEditDialogProps = {
    group: Group;
};

export function GroupEditDialog({ group }: GroupEditDialogProps) {
    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button variant="outline">
                        <Pencil />
                        Rediger gruppe
                    </Button>
                }
            />
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rediger gruppen</DialogTitle>
                    <DialogDescription>
                        Her kan du redigere gruppenavn, beskrivelse, bilde og
                        kontaktperson.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="group-name">
                                Gruppenavn *
                            </FieldLabel>
                            <Input
                                id="group-name"
                                defaultValue={group.name}
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Valgt bilde</FieldLabel>
                            <div className="flex items-center gap-2">
                                <div className="size-16 rounded-md bg-muted" />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                >
                                    <X />
                                    Fjern bilde
                                </Button>
                            </div>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="group-description">
                                Gruppebeskrivelse
                            </FieldLabel>
                            <Textarea
                                id="group-description"
                                rows={4}
                                defaultValue={group.description}
                            />
                            <p className="text-xs text-muted-foreground">
                                Hvordan formaterer jeg teksten?
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="group-email">
                                Kontakt e-post
                            </FieldLabel>
                            <Input
                                id="group-email"
                                type="email"
                                defaultValue={group.contactEmail}
                            />
                        </Field>

                        <Separator />

                        <h3 className="text-sm font-medium">Botsystem</h3>
                        <Field>
                            <FieldLabel htmlFor="botsjef">Botsjef</FieldLabel>
                            <Input id="botsjef" defaultValue={group.botSjef} />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="botsystem">
                                Botsystem praktiske detaljer *
                            </FieldLabel>
                            <Textarea
                                id="botsystem"
                                rows={3}
                                defaultValue={group.botSystemPraktisk}
                            />
                            <p className="text-xs text-muted-foreground">
                                Hvordan formaterer jeg teksten?
                            </p>
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline">Avbryt</Button>
                    <Button>Oppdater</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
