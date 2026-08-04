import {
    authQueryOptions,
    invalidateAuth,
    requireOwnProfile,
} from "#/api/auth";
import { updateUserSettingsMutation } from "#/api/queries/user";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Switch } from "@tihlde/ui/ui/switch";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/innstillinger")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    const { data: session } = useQuery(authQueryOptions);
    const updateSettings = useMutation(updateUserSettingsMutation);

    const allowsPhotos = session?.user.settings?.allowsPhotosByDefault ?? false;

    async function handleAllowPhotosChange(checked: boolean) {
        await updateSettings.mutateAsync({
            data: { allowsPhotosByDefault: checked },
        });
        // Samtykket leses fra sesjonen (både her og på arrangementsiden), så
        // den må hentes på nytt for at endringen skal vises uten refresh.
        await invalidateAuth();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Personvern</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Field orientation="horizontal">
                    <FieldContent>
                        <FieldLabel htmlFor="allows-photos">
                            Bildesamtykke
                        </FieldLabel>
                        <FieldDescription>
                            Bilder av deg fra arrangementer kan publiseres.
                            Gjelder alle arrangementer du melder deg på etter at
                            du har endret dette.
                        </FieldDescription>
                    </FieldContent>
                    <Switch
                        id="allows-photos"
                        checked={allowsPhotos}
                        disabled={updateSettings.isPending}
                        onCheckedChange={handleAllowPhotosChange}
                    />
                </Field>
                {updateSettings.isError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Innstillingen ble ikke lagret</AlertTitle>
                        <AlertDescription>
                            Prøv på nytt. Står det seg, gi beskjed til TIHLDE.
                        </AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
        </Card>
    );
}
