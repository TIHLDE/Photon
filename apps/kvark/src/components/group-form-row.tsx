import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Share2 } from "lucide-react";

import type { Form } from "#/lib/group";

type GroupFormRowProps = {
    form: Form;
    /** Whether the viewer may administer the form (edit it, see answers). */
    canManage: boolean;
};

export function GroupFormRow({ form, canManage }: GroupFormRowProps) {
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
                <div className="flex flex-wrap items-center gap-2">
                    {canManage ? (
                        <Button variant="outline" size="sm">
                            Administrer
                        </Button>
                    ) : null}
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
                    <Button variant="outline" size="sm">
                        <Share2 />
                        Del
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
