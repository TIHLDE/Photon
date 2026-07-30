import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { RichEditor } from "@tihlde/ui/complex/markdown";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { CheckCircle2, XCircle } from "lucide-react";

import { useImageUploader } from "#/api/queries/assets";
import { createNewsMutation } from "#/api/queries/news";
import { AdminImageField } from "#/components/admin-image-field";
import { AdminNoAccess } from "#/components/admin-no-access";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { richRegistry } from "#/components/markdown/directives/presets";

export const Route = createFileRoute("/admin/nyheter")({
    component: NewsAdminPage,
});

function NewsAdminPage() {
    const canCreate = useAnyScopePermission(["news:create", "news:manage"]);
    const [title, setTitle] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [body, setBody] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imageAlt, setImageAlt] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);

    const createNews = useMutation(createNewsMutation);
    const { uploadImage, isUploading } = useImageUploader();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);

        let imageUrl: string | undefined;
        if (image) {
            try {
                imageUrl = await uploadImage(image);
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
                    title,
                    header: excerpt,
                    body,
                    emojisAllowed: false,
                    imageUrl,
                    imageAlt: imageUrl ? imageAlt || undefined : undefined,
                },
            },
            {
                onSuccess() {
                    setTitle("");
                    setExcerpt("");
                    setBody("");
                    setImage(null);
                    setImageAlt("");
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
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Innhold</CardTitle>
                            <CardDescription>
                                Tittel, utdrag, og brødtekst. Brødteksten lagres
                                som markdown i databasen.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="news-title">
                                        Tittel
                                    </FieldLabel>
                                    <Input
                                        id="news-title"
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="news-excerpt">
                                        Utdrag
                                    </FieldLabel>
                                    <Textarea
                                        id="news-excerpt"
                                        rows={2}
                                        required
                                        value={excerpt}
                                        onChange={(event) =>
                                            setExcerpt(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel>Brødtekst</FieldLabel>
                                    <RichEditor
                                        registry={richRegistry}
                                        value={body}
                                        onChange={setBody}
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Forsidebilde</CardTitle>
                            <CardDescription>
                                Bildet vises på nyhetskortet og øverst på
                                nyhetssiden. Forhåndsvisningen under er nøyaktig
                                samme utsnitt som besøkende ser.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <AdminImageField
                                    label="Bilde"
                                    preset="cover-wide"
                                    value={image}
                                    onChange={setImage}
                                />
                                <Field>
                                    <FieldLabel htmlFor="news-image-alt">
                                        Bildebeskrivelse
                                    </FieldLabel>
                                    <Input
                                        id="news-image-alt"
                                        type="text"
                                        maxLength={255}
                                        placeholder="Kort beskrivelse for skjermlesere"
                                        value={imageAlt}
                                        onChange={(event) =>
                                            setImageAlt(event.target.value)
                                        }
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

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

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={createNews.isPending || isUploading}
                        >
                            {isUploading ? "Laster opp bilde …" : "Publiser"}
                        </Button>
                    </div>
                </form>
            ) : null}
        </div>
    );
}
