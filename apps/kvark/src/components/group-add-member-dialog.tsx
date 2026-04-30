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
import { Plus } from "lucide-react";
import { useState } from "react";

import { UserSingleCombobox } from "#/components/user-combobox";

type GroupAddMemberDialogProps = {
    users: string[];
};

export function GroupAddMemberDialog({ users }: GroupAddMemberDialogProps) {
    const [user, setUser] = useState<string | null>(null);

    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button size="sm">
                        <Plus />
                        Legg til
                    </Button>
                }
            />
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Legg til medlem</DialogTitle>
                    <DialogDescription>
                        Brukeren vil motta en epost/varsel om at de er lagt til
                        i gruppen.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Søk etter bruker</FieldLabel>
                            <UserSingleCombobox
                                items={users}
                                value={user}
                                onValueChange={setUser}
                                placeholder="Søk etter bruker"
                            />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button>Legg til medlem</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
