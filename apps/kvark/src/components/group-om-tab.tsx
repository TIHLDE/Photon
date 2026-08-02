import { Card } from "@tihlde/ui/ui/card";
import { MarkdownView } from "@tihlde/ui/complex/markdown";

import { GroupPageHeader } from "#/components/group-page-header";
import { richRegistry } from "#/components/markdown/directives/presets";
import { assetImageProps } from "#/lib/assets";
import type { Group } from "#/lib/group";

type GroupOmTabProps = {
    group: Group;
};

export function GroupOmTab({ group }: GroupOmTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Om" />
            {group.imageUrl ? (
                <Card className="max-w-2xl overflow-hidden p-0">
                    <img
                        {...assetImageProps(group.imageUrl, "hero")}
                        alt={group.name}
                        decoding="async"
                        className="aspect-video size-full object-cover"
                    />
                </Card>
            ) : null}

            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-medium">Hva gjør {group.name}?</h3>
                {group.description ? (
                    <MarkdownView
                        registry={richRegistry}
                        source={group.description}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Ingen beskrivelse tilgjengelig ennå.
                    </p>
                )}
            </div>
        </div>
    );
}
