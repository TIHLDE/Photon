import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MarkdownView, RichEditor } from "@tihlde/ui/complex/markdown";
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

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Real submission will call a mutation defined in #/api/queries/news
        // and post { title, excerpt, body } as markdown. For now, log it.
        // oxlint-disable: no-console
        console.log("submit news", { title, excerpt, body });
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Ny nyhet</h1>
                <p className="text-muted-foreground">
                    Skriv en nyhet i markdown-redigeringsverktøyet under.
                    Forhåndsvisning til høyre.
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
                        <CardTitle>Forhåndsvisning</CardTitle>
                        <CardDescription>
                            Slik vises nyheten med rik-registret aktivert.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MarkdownView registry={richRegistry} source={body} />
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit">Publiser</Button>
                </div>
            </form>
        </div>
    );
}
