import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { ArrowLeft, CalendarDays, Clock3, PencilLine } from "lucide-react";

import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailPage } from "#/components/detail-page";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { getNewsBySlug } from "#/mock/news";

export const Route = createFileRoute("/_app/nyheter/$slug")({
    component: NewsDetailPage,
    loader: ({ params }) => {
        const news = getNewsBySlug(params.slug);
        if (!news) throw notFound();
        return { news };
    },
});

function NewsDetailPage() {
    const { news } = Route.useLoaderData();

    return (
        <DetailPage
            back={
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
            }
            hero={<DetailHero imageUrl={news.imageUrl} />}
            header={
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex flex-col gap-3">
                            <h1 className="text-3xl md:text-4xl">
                                {news.title}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {news.excerpt}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm">
                                <PencilLine />
                                Rediger nyhet
                            </Button>
                            <ShareButton label="Del nyhet" />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <DetailField
                            icon={CalendarDays}
                            value={`Publisert ${news.publishedAtAbsolute}`}
                        />
                        {news.updatedAt && (
                            <DetailField
                                icon={Clock3}
                                value={`Oppdatert ${news.updatedAt}`}
                            />
                        )}
                    </div>
                </>
            }
            body={
                <>
                    <Separator />
                    <MarkdownView registry={richRegistry} source={news.body} />
                </>
            }
        />
    );
}
