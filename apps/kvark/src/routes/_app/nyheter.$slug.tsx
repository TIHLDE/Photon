import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { ArrowLeft, CalendarDays, Clock3, PencilLine } from "lucide-react";

import { ReactionsBar, type Reaction } from "#/components/reactions-bar";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { getNewsBySlug } from "#/data/news";

export const Route = createFileRoute("/_app/nyheter/$slug")({
    component: NewsDetailPage,
    loader: ({ params }) => {
        const news = getNewsBySlug(params.slug);
        if (!news) throw notFound();
        return { news };
    },
});

const REACTIONS: Reaction[] = [
    { emoji: "🎉", count: 12, reacted: true },
    { emoji: "👍", count: 7 },
    { emoji: "💜", count: 4 },
];

function NewsDetailPage() {
    const { news } = Route.useLoaderData();

    return (
        <article className="container mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:py-10">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/nyheter" />}
                >
                    <ArrowLeft />
                    Alle nyheter
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl">
                <div className="aspect-[16/9] w-full bg-muted">
                    {news.imageUrl ? (
                        <img
                            src={news.imageUrl}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : null}
                </div>
            </div>

            <header className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="secondary">Nyhet</Badge>
                        {news.reactionsEnabled ? (
                            <ReactionsBar reactions={REACTIONS} />
                        ) : null}
                    </div>
                    <h1 className="text-3xl md:text-4xl">{news.title}</h1>
                    <p className="text-lg text-muted-foreground">
                        {news.excerpt}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        Publisert {news.publishedAtAbsolute}
                    </span>
                    {news.updatedAt ? (
                        <span className="flex items-center gap-1.5">
                            <Clock3 className="size-4" />
                            Oppdatert {news.updatedAt}
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm">
                        <PencilLine />
                        Rediger nyhet
                    </Button>
                    <ShareButton label="Del nyhet" />
                </div>
            </header>

            <Separator />

            <MarkdownView registry={richRegistry} source={news.body} />
        </article>
    );
}
