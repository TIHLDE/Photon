import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { Card } from "@tihlde/ui/ui/card";

import { getGroupBySlugQuery } from "#/api/queries/groups";
import { richRegistry } from "#/components/markdown/directives/presets";
import { assetImageProps } from "#/lib/assets";
import { mapGroup } from "#/lib/group";

export const Route = createFileRoute("/_app/grupper/$slug/")({
    component: GroupOverviewPage,
});

function GroupOverviewPage() {
    const { slug } = Route.useParams();
    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));
    const group = mapGroup(apiGroup);
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">Om</h2>
            </div>

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
