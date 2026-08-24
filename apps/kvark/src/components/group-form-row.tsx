import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { ListChecksIcon, PencilIcon } from "lucide-react";

import { ShareButton } from "#/components/share-button";
import { formatFormScheduleAt } from "#/lib/form";
import type { Form } from "#/lib/group";

type GroupFormRowProps = {
    form: Form;
    /** Om den som ser på kan redigere skjemaet og se svarene. */
    canManage: boolean;
    onEdit: () => void;
};

export function GroupFormRow({ form, canManage, onEdit }: GroupFormRowProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <FormScheduleNote form={form} canManage={canManage} />
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        render={
                            <Link
                                to="/sporreskjema/$id"
                                params={{ id: form.id }}
                            />
                        }
                    >
                        Svar på/se skjema
                    </Button>
                    {canManage ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onEdit}
                            >
                                <PencilIcon />
                                Rediger
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                render={
                                    <Link
                                        to="/sporreskjema/$id/svar"
                                        params={{ id: form.id }}
                                    />
                                }
                            >
                                <ListChecksIcon />
                                Se svar
                            </Button>
                        </>
                    ) : null}
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

/**
 * Én linje om når skjemaet tar imot svar.
 *
 * Et skjema kan være stengt av tre grunner, og de trenger hver sin beskjed:
 * det er ikke åpnet ennå, svarfristen har gått ut, eller noen har stengt det.
 * Et åpent skjema med en frist sier når fristen går ut, så man vet at det
 * haster; ellers sier det ingenting.
 */
function FormScheduleNote({
    form,
    canManage,
}: {
    form: Form;
    canManage: boolean;
}) {
    if (form.isOpenNow) {
        return form.closesAt ? (
            <p className="text-sm text-muted-foreground">
                Spørreskjemaet stenger {formatFormScheduleAt(form.closesAt)}.
            </p>
        ) : null;
    }

    // Et skjema kan ha begge tidspunktene. Har åpningen passert, er det
    // fristen som er grunnen til at det er stengt — ellers ville linja sagt at
    // skjemaet «åpner» på et tidspunkt som var i går.
    const opensInTheFuture =
        form.opensAt !== null && new Date(form.opensAt).getTime() > Date.now();

    if (form.isOpen && opensInTheFuture && form.opensAt) {
        return (
            <p className="text-sm text-muted-foreground">
                Spørreskjemaet åpner {formatFormScheduleAt(form.opensAt)}.
            </p>
        );
    }

    if (form.isOpen && form.closesAt) {
        return (
            <p className="text-sm text-muted-foreground">
                Spørreskjemaet stengte {formatFormScheduleAt(form.closesAt)}.
                {canManage
                    ? " Fjern eller flytt stengetidspunktet under «Rediger» for å ta imot svar igjen."
                    : ""}
            </p>
        );
    }

    return (
        <p className="text-sm text-muted-foreground">
            Spørreskjemaet er ikke åpent for innsending av svar.
            {canManage
                ? " Åpne det under «Rediger» for å kunne svare på og dele skjemaet."
                : ""}
        </p>
    );
}
