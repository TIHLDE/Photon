import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { NewsForm } from "~/components/admin/news-form";
import { getNewsQuery } from "~/lib/queries/news";

export const Route = createFileRoute("/_main/admin/nyheter/$newsId")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getNewsQuery(params.newsId)),
    component: EditNewsPage,
});

function EditNewsPage() {
    const { newsId } = Route.useParams();
    const { data: article } = useSuspenseQuery(getNewsQuery(newsId));

    if (!article) return null;

    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">
                Rediger: {article.title}
            </h1>
            <NewsForm
                newsId={newsId}
                initialData={{
                    title: article.title,
                    header: article.header,
                    body: article.body,
                    imageUrl: article.imageUrl,
                    imageAlt: article.imageAlt,
                    emojisAllowed: article.emojisAllowed,
                }}
            />
        </div>
    );
}
