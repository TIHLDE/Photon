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

import type { UserSearchOption } from "#/components/user-search-combobox";
import { UserSearchCombobox } from "#/components/user-search-combobox";

export type GroupAddMemberDialogProps = {
    /** Søketekst — eies av forelderen, som også henter treffene. */
    query: string;
    onQueryChange: (query: string) => void;
    results: UserSearchOption[];
    isSearching?: boolean;
    isAdding?: boolean;
    error?: string | null;
    /**
     * Legg til brukeren. Dialogen lukkes først når løftet innfris — feiler
     * det, blir den stående med feilmeldingen i `error`.
     */
    onAdd: (userId: string) => Promise<void>;
};

export function GroupAddMemberDialog({
    query,
    onQueryChange,
    results,
    isSearching,
    isAdding,
    error,
    onAdd,
}: GroupAddMemberDialogProps) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<UserSearchOption | null>(null);

    function close() {
        setOpen(false);
        setSelected(null);
        onQueryChange("");
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
            // Trefflisten portaleres ut av dialogen, så et klikk på et
            // søketreff teller som «klikk utenfor» og lukket hele dialogen.
            // Man lukker med Avbryt, X eller Escape i stedet.
            disablePointerDismissal
        >
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
                <FieldGroup>
                    <Field>
                        <FieldLabel>Søk etter bruker</FieldLabel>
                        {/*
                          Samme velger som i rolleadmin. Den holder valget
                          utenfor trefflisten — en combobox der verdien må
                          finnes blant `items` mister valget i det man tar
                          det, fordi valget selv endrer søket.
                        */}
                        <UserSearchCombobox
                            holder={selected}
                            emptyLabel="Velg bruker"
                            query={query}
                            onQueryChange={onQueryChange}
                            results={results}
                            isSearching={isSearching}
                            onSelect={setSelected}
                        />
                    </Field>
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                </FieldGroup>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Avbryt
                    </Button>
                    <Button
                        disabled={!selected || isAdding}
                        onClick={() => {
                            if (!selected) return;
                            void onAdd(selected.id).then(close, () => {
                                // Feilen vises via `error`; dialogen blir
                                // stående så man kan prøve igjen.
                            });
                        }}
                    >
                        {isAdding ? "Legger til …" : "Legg til medlem"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
