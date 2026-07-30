import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

import { ShareButton } from "#/components/share-button";
import type { Form } from "#/lib/group";

type GroupFormRowProps = {
    form: Form;
};

export function GroupFormRow({ form }: GroupFormRowProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {!form.isOpen ? (
                    <p className="text-sm text-muted-foreground">
                        Spørreskjemaet er ikke åpent for innsending av svar. Du
                        må åpne spørreskjemaet for innsending for å kunne svare
                        på og dele skjemaet.
                    </p>
                ) : null}
                {/* «Administrer» lå her, men det finnes ingen side for å se
                    eller redigere svar ennå — knappen gjorde ingenting. Den
                    kommer tilbake når administrasjonsgrensesnittet finnes. */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={
                            <Link
                                to="/sporreskjema/$id"
                                params={{ id: form.id }}
                            />
                        }
                    >
                        Svar på/se skjema
                    </Button>
                    <ShareButton
                        showLabel
                        label="Del skjema"
                        url={`${typeof window === "undefined" ? "" : window.location.origin}/sporreskjema/${form.id}`}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
