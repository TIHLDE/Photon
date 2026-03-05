import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "~/components/empty-state";
import { Page } from "~/components/layout/page";
import { NewsCard } from "~/components/news-card";
import { NewsCardSkeleton } from "~/components/news-card-skeleton";
import { listNewsQuery } from "~/lib/queries/news";

export const Route = createFileRoute("/_main/nyheter/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listNewsQuery()),
    component: NewsPage,
});

function NewsPage() {
    return (
        <Page>
            <div className="space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Nyheter</h1>
                    <p className="mt-1 text-muted-foreground">
                        Siste nytt fra TIHLDE
                    </p>
                </div>

                <Suspense fallback={<NewsListSkeleton />}>
                    <NewsList />
                </Suspense>
            </div>
        </Page>
    );
}

function NewsList() {
    const { data } = useSuspenseQuery(listNewsQuery());

    if (!data || data.items.length === 0) {
        return (
            <EmptyState
                icon={Newspaper}
                title="Ingen nyheter"
                description="Det er ingen nyheter å vise akkurat nå"
            />
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((news) => (
                <NewsCard key={news.id} news={news} />
            ))}
        </div>
    );
}

function NewsListSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <NewsCardSkeleton key={i} />
            ))}
        </div>
    );
}
