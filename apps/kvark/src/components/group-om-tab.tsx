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

            <div
                className={
                    group.imageUrl
                        ? "grid gap-6 lg:grid-cols-2 lg:items-start"
                        : "grid gap-6"
                }
            >
                {group.imageUrl ? (
                    <Card className="order-1 max-w-2xl overflow-hidden p-0 lg:order-2 lg:sticky lg:top-24">
                        <img
                            {...assetImageProps(group.imageUrl, "hero")}
                            alt={group.name}
                            decoding="async"
                            className="aspect-video size-full object-cover"
                        />
                    </Card>
                ) : null}

                <div className="order-2 flex flex-col gap-3 lg:order-1">
                    <h3 className="text-lg font-medium">
                        Hva gjør {group.name}?
                    </h3>
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
        </div>
    );
}
