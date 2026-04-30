import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Share2 } from "lucide-react";

import type { Form } from "#/mock/group-detail";

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
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm">
                        Administrer
                    </Button>
                    <Button variant="outline" size="sm">
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
