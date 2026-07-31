import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Reveal, Stagger } from "@tihlde/ui/ui/motion";

import { getNewsQuery } from "#/api/queries/news";
import { NewsCard } from "#/components/news-card";
import { formatNewsDateRelative } from "#/lib/news";

export const Route = createFileRoute("/_app/nyheter/")({
    component: NewsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getNewsQuery(0)),
});

function NewsPage() {
    const { data } = useSuspenseQuery(getNewsQuery(0));
    const news = data.items;

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <Reveal render={<div className="flex flex-col gap-1" />}>
                <h1 className="text-3xl">Nyheter</h1>
                <p className="text-muted-foreground">
                    Siste nytt fra TIHLDE og undergruppene
                </p>
            </Reveal>

            <Stagger
                render={
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
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
