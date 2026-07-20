import { Card } from "@tihlde/ui/ui/card";

import { GroupPageHeader } from "#/components/group-page-header";
import type { Group } from "#/lib/group";

type GroupOmTabProps = {
    group: Group;
};

export function GroupOmTab({ group }: GroupOmTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Om" />
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-6">
                    {group.imageUrl ? (
                        <Card className="overflow-hidden p-0">
                            <img
                                src={group.imageUrl}
                                alt={group.name}
                                className="aspect-video size-full object-cover"
                            />
                        </Card>
                    ) : null}
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-medium">
                            Hva gjør {group.name}?
                        </h3>
                        {group.description ? (
                            <p className="text-sm text-muted-foreground">
                                {group.description}
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Ingen beskrivelse tilgjengelig ennå.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
