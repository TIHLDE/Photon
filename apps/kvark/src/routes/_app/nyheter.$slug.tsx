import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { ArrowLeft, CalendarDays, Clock3, PencilLine } from "lucide-react";

import { getNewsByIdQuery } from "#/api/queries/news";
import { useCanActOnResource } from "#/hooks/use-permission";
import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailPage } from "#/components/detail-page";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { formatNewsDate, wasNewsUpdated } from "#/lib/news";

export const Route = createFileRoute("/_app/nyheter/$slug")({
    component: NewsDetailPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getNewsByIdQuery(params.slug)),
});

function NewsDetailPage() {
    const { slug } = Route.useParams();

    const { data: news } = useSuspenseQuery(getNewsByIdQuery(slug));
    // Same rule as the API: the permission, or having written the article.
    const canEdit = useCanActOnResource(["news:update", "news:manage"])(
        news.createdById,
    );

    const updated = wasNewsUpdated(news.createdAt, news.updatedAt);

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
            hero={<DetailHero imageUrl={news.imageUrl || undefined} />}
            header={
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex flex-col gap-3">
                            <h1 className="text-3xl md:text-4xl">
                                {news.title}
                            </h1>
                            {news.header ? (
                                <p className="text-lg text-muted-foreground">
                                    {news.header}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {canEdit ? (
                                <Button variant="outline" size="sm">
                                    <PencilLine />
                                    Rediger nyhet
                                </Button>
                            ) : null}
                            <ShareButton label="Del nyhet" />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <DetailField
                            icon={CalendarDays}
                            value={`Publisert ${formatNewsDate(news.createdAt)}`}
                        />
                        {updated ? (
                            <DetailField
                                icon={Clock3}
                                value={`Oppdatert ${formatNewsDate(news.updatedAt)}`}
                            />
                        ) : null}
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
