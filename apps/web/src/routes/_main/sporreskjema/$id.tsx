import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getFormQuery } from "~/lib/queries/forms";

export const Route = createFileRoute("/_main/sporreskjema/$id")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getFormQuery(params.id)),
    component: FormPage,
});

function FormPage() {
    const { id } = Route.useParams();
    const { data: form } = useSuspenseQuery(getFormQuery(id));

    if (!form) return null;

    return (
        <Page className="max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="font-heading text-2xl">
                        {form.title}
                    </CardTitle>
                    {form.description && (
                        <p className="text-sm text-muted-foreground">
                            {form.description}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Skjemautfylling kommer snart.
                    </p>
                </CardContent>
            </Card>
        </Page>
    );
}
