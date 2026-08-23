import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { PlusIcon } from "lucide-react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { getNewsQuery } from "#/api/queries/news";
import { NewsCard } from "#/components/news-card";
import { PageHeader } from "#/components/page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { formatNewsDateRelative } from "#/lib/news";

/** Module-level so the permission lookup keeps a stable identity. */
const NEWS_CREATE_PERMISSIONS = ["news:create", "news:manage"] as const;

export const Route = createFileRoute("/_app/nyheter/")({
    component: NewsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getNewsQuery(0)),
});

function NewsPage() {
    const { data } = useSuspenseQuery(getNewsQuery(0));
    const news = data.items;
    // Scopet er ukjent på en offentlig liste, så any-scope er riktig her:
    // et gruppe-scopet news:create er en ekte tilgang, og API-et avviser
    // uansett den enkelte forespørselen som ikke treffer.
    const canCreateNews = useAnyScopePermission(NEWS_CREATE_PERMISSIONS);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <PageHeader
                title="Nyheter"
                description="Siste nytt fra TIHLDE og undergruppene"
                action={
                    canCreateNews ? (
                        <Button
                            render={
                                <Link
                                    to="/admin/nyheter"
                                    search={{ ny: true }}
                                />
                            }
                        >
                            <PlusIcon className="size-4" />
                            Ny nyhet
                        </Button>
                    ) : null
                }
            />

            <Stagger
                render={
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
                }
            >
                {news.map((item) => (
                    <li key={item.id}>
                        <NewsCard
                            slug={item.id}
                            title={item.title}
                            excerpt={item.header ?? ""}
                            publishedAt={formatNewsDateRelative(item.createdAt)}
                            imageUrl={item.imageUrl || undefined}
                        />
                    </li>
                ))}
            </Stagger>
        </div>
    );
}
