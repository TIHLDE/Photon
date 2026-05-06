import { createFileRoute } from "@tanstack/react-router";

import { NewsCard } from "#/components/news-card";
import { NEWS } from "#/mock/news";

export const Route = createFileRoute("/_app/nyheter/")({ component: NewsPage });

function NewsPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nyheter</h1>
                <p className="text-muted-foreground">
                    Siste nytt fra TIHLDE og undergruppene
                </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {NEWS.map((item) => (
                    <li key={item.slug}>
                        <NewsCard
                            slug={item.slug}
                            title={item.title}
                            excerpt={item.excerpt}
                            publishedAt={item.publishedAt}
                            imageUrl={item.imageUrl}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
