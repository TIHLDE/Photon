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
    /**
     * Teksten i dialogen. Standard er «legg til medlem»; lederoverføringen i
     * HS bruker samme søk og velger, men er en annen handling.
     */
    copy?: {
        trigger: string;
        title: string;
        description: string;
        submit: string;
        submitting: string;
    };
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

const DEFAULT_COPY = {
    trigger: "Legg til",
    title: "Legg til medlem",
    description:
        "Brukeren vil motta en epost/varsel om at de er lagt til i gruppen.",
    submit: "Legg til medlem",
    submitting: "Legger til …",
} as const;

export function GroupAddMemberDialog({
    copy = DEFAULT_COPY,
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
                        {copy.trigger}
                    </Button>
                }
            />
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
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
                        {isAdding ? copy.submitting : copy.submit}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
