import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { ArrowLeft, XCircle } from "lucide-react";
import type { UpdateNews } from "@tihlde/sdk";

import { useImageUploader } from "#/api/queries/assets";
import { getNewsByIdQuery, updateNewsMutation } from "#/api/queries/news";
import { AdminNoAccess } from "#/components/admin-no-access";
import { NewsForm, type NewsFormValues } from "#/components/news-form";
import { useCanActOnResource } from "#/hooks/use-permission";

export const Route = createFileRoute("/_app/nyheter/$slug_/rediger")({
    component: EditNewsPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getNewsByIdQuery(params.slug)),
});

function EditNewsPage() {
    const { slug } = Route.useParams();
    const navigate = useNavigate();

    const { data: news } = useSuspenseQuery(getNewsByIdQuery(slug));

    // Samme regel som API-et: rettigheten, eller å ha skrevet nyheten selv.
    const canEdit = useCanActOnResource(["news:update", "news:manage"])(
        news.createdById,
    );

    const [values, setValues] = useState<NewsFormValues>(() => ({
        title: news.title,
        excerpt: news.header,
        body: news.body,
        image: null,
        imageAlt: news.imageAlt ?? "",
    }));
    const [uploadError, setUploadError] = useState<string | null>(null);

    const updateNews = useMutation(updateNewsMutation);
    const { uploadImage, isUploading } = useImageUploader();

    function handleChange(patch: Partial<NewsFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);

        // Lastes opp først: en feilet opplasting skal ikke lagre resten av
        // endringene med et bilde som mangler.
        let imageUrl: string | undefined;
        if (values.image) {
            try {
                imageUrl = await uploadImage(values.image);
            } catch (err) {
                setUploadError(
                    err instanceof Error ? err.message : String(err),
                );
                return;
            }
        }

        const data: UpdateNews = {
            title: values.title,
            header: values.excerpt,
            body: values.body,
            // Utelatt når ingen ny fil er valgt, slik at det lagrede bildet
            // blir stående.
            ...(imageUrl ? { imageUrl } : {}),
            imageAlt: values.imageAlt || null,
        };

        updateNews.mutate(
            { newsId: news.id, data },
            {
                onSuccess() {
                    navigate({
                        to: "/nyheter/$slug",
                        params: { slug: news.id },
                    });
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={
                        <Link to="/nyheter/$slug" params={{ slug: news.id }} />
                    }
                >
                    <ArrowLeft />
                    Tilbake til nyheten
                </Button>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Rediger nyhet</h1>
                <p className="text-muted-foreground">
                    Endringene vises på nyhetssiden så snart du lagrer.
                </p>
            </div>

            {!canEdit ? (
                <AdminNoAccess action="redigere denne nyheten" />
            ) : (
                <NewsForm
                    values={values}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    existingImageUrl={news.imageUrl}
                    submitLabel={
                        isUploading ? "Laster opp bilde …" : "Lagre endringer"
                    }
                    isSubmitting={updateNews.isPending || isUploading}
                >
                    {uploadError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                            <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                    )}
                    {updateNews.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke lagre</AlertTitle>
                            <AlertDescription>
                                {updateNews.error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </NewsForm>
            )}
        </div>
    );
}
