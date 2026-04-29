import { Button } from "@tihlde/ui/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@tihlde/ui/ui/input-group";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { GroupLawFormDialog } from "#/components/group-law-form-dialog";
import { GroupLawItem } from "#/components/group-law-item";
import { GroupPageHeader } from "#/components/group-page-header";
import { LAWS, type Law } from "#/routes/_app/grupper.$slug.mock";

export function GroupLawsTab() {
    const [editing, setEditing] = useState<Law | null>(null);
    const [creating, setCreating] = useState(false);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return LAWS;
        return LAWS.filter(
            (law) =>
                law.paragraph.toLowerCase().includes(q) ||
                law.title.toLowerCase().includes(q) ||
                law.description.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Lovverk"
                action={
                    <Button onClick={() => setCreating(true)}>
                        <Plus />
                        Ny lovparagraf
                    </Button>
                }
            />

            <InputGroup>
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk i lovverket..."
                />
            </InputGroup>

            <ol className="flex flex-col">
                {filtered.map((law) => (
                    <li key={law.paragraph}>
                        <GroupLawItem
                            law={law}
                            onEdit={() => setEditing(law)}
                        />
                    </li>
                ))}
            </ol>

            <GroupLawFormDialog
                open={editing !== null || creating}
                law={editing}
                onClose={() => {
                    setEditing(null);
                    setCreating(false);
                }}
            />
        </div>
    );
}
