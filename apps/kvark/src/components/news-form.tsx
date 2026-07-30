import { RichEditor } from "@tihlde/ui/complex/markdown";
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
import type { ReactNode } from "react";

import { AdminImageField } from "#/components/admin-image-field";
import { richRegistry } from "#/components/markdown/directives/presets";

export type NewsFormValues = {
    title: string;
    excerpt: string;
    body: string;
    image: File | null;
    imageAlt: string;
};

export const EMPTY_NEWS_FORM: NewsFormValues = {
    title: "",
    excerpt: "",
    body: "",
    image: null,
    imageAlt: "",
};

type NewsFormProps = {
    values: NewsFormValues;
    onChange: (patch: Partial<NewsFormValues>) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    submitLabel: string;
    isSubmitting: boolean;
    /** Vises i bildefeltet når nyheten allerede har et bilde. */
    existingImageUrl?: string | null;
    /** Varsler og feilmeldinger fra kalleren, rett over knappen. */
    children?: ReactNode;
};

/**
 * Skjemaet for en nyhet. Delt mellom «Ny nyhet» i adminpanelet og
 * redigeringssiden, slik at feltene ikke drifter fra hverandre.
 */
export function NewsForm({
    values,
    onChange,
    onSubmit,
    submitLabel,
    isSubmitting,
    existingImageUrl,
    children,
}: NewsFormProps) {
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
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
                            <FieldLabel htmlFor="news-title">Tittel</FieldLabel>
                            <Input
                                id="news-title"
                                type="text"
                                required
                                value={values.title}
                                onChange={(event) =>
                                    onChange({ title: event.target.value })
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
                                value={values.excerpt}
                                onChange={(event) =>
                                    onChange({ excerpt: event.target.value })
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Brødtekst</FieldLabel>
                            <RichEditor
                                registry={richRegistry}
                                value={values.body}
                                onChange={(body) => onChange({ body })}
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Forsidebilde</CardTitle>
                    <CardDescription>
                        Bildet vises på nyhetskortet og øverst på nyhetssiden.
                        Forhåndsvisningen under er nøyaktig samme utsnitt som
                        besøkende ser.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <AdminImageField
                            label="Bilde"
                            preset="cover-wide"
                            value={values.image}
                            existingImageUrl={existingImageUrl}
                            onChange={(image) => onChange({ image })}
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
                                value={values.imageAlt}
                                onChange={(event) =>
                                    onChange({ imageAlt: event.target.value })
                                }
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            {children}

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
