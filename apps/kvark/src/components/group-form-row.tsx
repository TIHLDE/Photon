import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { ListChecksIcon, PencilIcon } from "lucide-react";

import { ShareButton } from "#/components/share-button";
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
                {!form.isOpen ? (
                    <p className="text-sm text-muted-foreground">
                        Spørreskjemaet er ikke åpent for innsending av svar.
                        {canManage
                            ? " Åpne det under «Rediger» for å kunne svare på og dele skjemaet."
                            : ""}
                    </p>
                ) : null}
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
