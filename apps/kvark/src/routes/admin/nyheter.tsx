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

import { createNewsMutation } from "#/api/queries/news";
import { richRegistry } from "#/components/markdown/directives/presets";

export const Route = createFileRoute("/admin/nyheter")({
    component: NewsAdminPage,
});

const INITIAL_BODY = `:::callout{type=info title="Tip"}
Use directives like callouts to highlight important information for readers.
:::

Add the body of the news article here using **markdown** and any directive
exposed by the rich registry.
`;

function NewsAdminPage() {
    const [title, setTitle] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [body, setBody] = useState(INITIAL_BODY);

    const createNews = useMutation(createNewsMutation);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        createNews.mutate(
            {
                data: {
                    title,
                    header: excerpt,
                    body,
                    emojisAllowed: false,
                },
            },
            {
                onSuccess() {
                    setTitle("");
                    setExcerpt("");
                    setBody(INITIAL_BODY);
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Innhold</CardTitle>
                        <CardDescription>
                            Tittel, utdrag, og brødtekst. Brødteksten lagres som
                            markdown i databasen.
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
                    <Button type="submit" disabled={createNews.isPending}>
                        Publiser
                    </Button>
                </div>
            </form>
        </div>
    );
}
