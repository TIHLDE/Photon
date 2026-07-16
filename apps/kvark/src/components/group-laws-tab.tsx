import { GroupPageHeader } from "#/components/group-page-header";

export function GroupLawsTab() {
    // There is no laws/lovverk endpoint on the backend yet.
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Lovverk" />
            <p className="text-sm text-muted-foreground">
                Ingen lovverk tilgjengelig ennå.
            </p>
        </div>
    );
}
