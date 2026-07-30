import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";

import { useImageUploader } from "#/api/queries/assets";
import { createNewsMutation } from "#/api/queries/news";
import { AdminNoAccess } from "#/components/admin-no-access";
import {
    EMPTY_NEWS_FORM,
    NewsForm,
    type NewsFormValues,
} from "#/components/news-form";
import { useAnyScopePermission } from "#/hooks/use-permission";

export const Route = createFileRoute("/admin/nyheter")({
    component: NewsAdminPage,
});

function NewsAdminPage() {
    const canCreate = useAnyScopePermission(["news:create", "news:manage"]);
    const [values, setValues] = useState<NewsFormValues>(EMPTY_NEWS_FORM);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const createNews = useMutation(createNewsMutation);
    const { uploadImage, isUploading } = useImageUploader();

    function handleChange(patch: Partial<NewsFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);

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

        createNews.mutate(
            {
                data: {
                    title: values.title,
                    header: values.excerpt,
                    body: values.body,
                    emojisAllowed: false,
                    imageUrl,
                    imageAlt: imageUrl
                        ? values.imageAlt || undefined
                        : undefined,
                },
            },
            {
                onSuccess() {
                    setValues(EMPTY_NEWS_FORM);
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Ny nyhet</h1>
                <p className="text-muted-foreground">
                    Skriv en nyhet i markdown-redigeringsverktøyet under.
                    Formateringen vises direkte mens du skriver.
                </p>
            </div>

            {!canCreate ? <AdminNoAccess action="publisere nyheter" /> : null}

            {canCreate ? (
                <NewsForm
                    values={values}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    submitLabel={
                        isUploading ? "Laster opp bilde …" : "Publiser"
                    }
                    isSubmitting={createNews.isPending || isUploading}
                >
                    {uploadError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                            <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                    )}
                    {createNews.isSuccess && (
                        <Alert>
                            <CheckCircle2 className="size-4" />
                            <AlertTitle>Publisert</AlertTitle>
                            <AlertDescription>
                                Nyheten ble opprettet.
                            </AlertDescription>
                        </Alert>
                    )}
                    {createNews.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke publisere</AlertTitle>
                            <AlertDescription>
                                {createNews.error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </NewsForm>
            ) : null}
        </div>
    );
}
