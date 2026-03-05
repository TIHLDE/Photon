import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "~/components/empty-state";
import { Page } from "~/components/layout/page";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { listGroupsQuery } from "~/lib/queries/groups";

export const Route = createFileRoute("/_main/grupper/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listGroupsQuery()),
    component: GroupsPage,
});

function GroupsPage() {
    return (
        <Page>
            <div className="space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Grupper</h1>
                    <p className="mt-1 text-muted-foreground">
                        Utforsk TIHLDEs undergrupper og komiteer
                    </p>
                </div>

                <Suspense fallback={<GroupsListSkeleton />}>
                    <GroupsList />
                </Suspense>
            </div>
        </Page>
    );
}

function GroupsList() {
    const { data } = useSuspenseQuery(listGroupsQuery());

    if (!data || data.length === 0) {
        return (
            <EmptyState
                icon={Users}
                title="Ingen grupper"
                description="Det er ingen grupper å vise"
            />
        );
    }

    const grouped = groupByType(data);

    return (
        <div className="space-y-8">
            {Object.entries(grouped).map(([type, groups]) => (
                <section key={type} className="space-y-3">
                    <h2 className="font-heading text-xl font-semibold capitalize">
                        {typeLabel(type)}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {groups.map((group) => (
                            <a key={group.slug} href={`/grupper/${group.slug}`}>
                                <Card className="group flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
                                    {group.imageUrl ? (
                                        <img
                                            src={group.imageUrl}
                                            alt={group.name}
                                            className="size-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                                            <Users className="size-5 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="font-medium group-hover:text-primary">
                                            {group.name}
                                        </h3>
                                        {group.description && (
                                            <p className="truncate text-sm text-muted-foreground">
                                                {group.description}
                                            </p>
                                        )}
                                    </div>
                                </Card>
                            </a>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function GroupsListSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Card key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="size-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                    </div>
                </Card>
            ))}
        </div>
    );
}

type GroupItem = {
    slug: string;
    name: string;
    type: string;
    imageUrl?: string | null;
    description?: string | null;
};

function groupByType(groups: GroupItem[]): Record<string, GroupItem[]> {
    const result: Record<string, GroupItem[]> = {};
    for (const g of groups) {
        const key = g.type || "other";
        if (!result[key]) result[key] = [];
        result[key].push(g);
    }
    return result;
}

const TYPE_LABELS: Record<string, string> = {
    committee: "Komiteer",
    interestgroup: "Interessegrupper",
    study: "Studiegrupper",
    board: "Styret",
    other: "Andre",
};

function typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
}
