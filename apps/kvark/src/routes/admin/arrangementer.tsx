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

import { richRegistry } from "#/components/markdown/directives/presets";

export const Route = createFileRoute("/admin/arrangementer")({
    component: EventAdminPage,
});

const INITIAL_DESCRIPTION = `# Arrangementsbeskrivelse

Beskriv arrangementet med **markdown**.

:::callout{type=warn title="Påmelding"}
Husk å sjekke kapasitet og påmeldingsfrist før du publiserer.
:::
`;

function EventAdminPage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState(INITIAL_DESCRIPTION);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // oxlint-disable: no-console
        console.log("submit event", { title, description });
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nytt arrangement</h1>
                <p className="text-muted-foreground">
                    Beskrivelsen lagres som markdown og rendres med samme
                    direktiv-registret som redigeringen.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Detaljer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="event-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="event-title"
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Beskrivelse</FieldLabel>
                                <RichEditor
                                    registry={richRegistry}
                                    value={description}
                                    onChange={setDescription}
                                />
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Forhåndsvisning</CardTitle>
                        <CardDescription>
                            Slik blir beskrivelsen vist for medlemmer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MarkdownView
                            registry={richRegistry}
                            source={description}
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit">Publiser</Button>
                </div>
            </form>
        </div>
    );
}
