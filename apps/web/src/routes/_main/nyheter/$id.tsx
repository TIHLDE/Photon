import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Page } from "~/components/layout/page";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { formatDateTime } from "~/lib/date";
import { getNewsQuery } from "~/lib/queries/news";

export const Route = createFileRoute("/_main/nyheter/$id")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getNewsQuery(params.id)),
    component: NewsDetailPage,
});

function NewsDetailPage() {
    const { id } = Route.useParams();
    const { data: news } = useSuspenseQuery(getNewsQuery(id));

    if (!news) return null;

    return (
        <Page className="max-w-3xl">
            <article className="space-y-6">
                <a
                    href="/nyheter"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Tilbake til nyheter
                </a>

                {news.imageUrl && (
                    <img
                        src={news.imageUrl}
                        alt={news.imageAlt ?? news.title}
                        className="w-full rounded-lg object-cover"
                    />
                )}

                <header className="space-y-2">
                    <h1 className="font-heading text-3xl font-bold md:text-4xl">
                        {news.title}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        {news.header}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <time>{formatDateTime(news.createdAt)}</time>
                        {news.creator && (
                            <>
                                <span>&middot;</span>
                                <span>{news.creator.name}</span>
                            </>
                        )}
                    </div>
                </header>

                <MarkdownRenderer content={news.body} />
            </article>
        </Page>
    );
}
