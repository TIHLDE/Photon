import {
    authQueryOptions,
    invalidateAuth,
    requireOwnProfile,
} from "#/api/auth";
import {
    getAllergiesQuery,
    updateUserSettingsMutation,
} from "#/api/queries/user";
import {
    AllergyPicker,
    type AllergySelection,
} from "#/components/allergy-picker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Switch } from "@tihlde/ui/ui/switch";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/profil/$id/innstillinger")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    const { data: session } = useQuery(authQueryOptions);
    const updateSettings = useMutation(updateUserSettingsMutation);

    const allowsPhotos = session?.user.settings?.allowsPhotosByDefault ?? false;
    // Ingen innstillinger-rad betyr standarden: du står oppført med navn.
    const publicRegistrations =
        session?.user.settings?.publicEventRegistrations ?? true;

    async function handleAllowPhotosChange(checked: boolean) {
        await updateSettings.mutateAsync({
            data: { allowsPhotosByDefault: checked },
        });
        // Samtykket leses fra sesjonen (både her og på arrangementsiden), så
        // den må hentes på nytt for at endringen skal vises uten refresh.
        await invalidateAuth();
    }

    async function handlePublicRegistrationsChange(checked: boolean) {
        await updateSettings.mutateAsync({
            data: { publicEventRegistrations: checked },
        });
        await invalidateAuth();
    }

    return (
        <div className="flex flex-col gap-6">
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
                                Gjelder alle arrangementer du melder deg på
                                etter at du har endret dette.
                            </FieldDescription>
                        </FieldContent>
                        <Switch
                            id="allows-photos"
                            checked={allowsPhotos}
                            disabled={updateSettings.isPending}
                            onCheckedChange={handleAllowPhotosChange}
                        />
                    </Field>
                    <Field orientation="horizontal">
                        <FieldContent>
                            <FieldLabel htmlFor="public-registrations">
                                Offentlige arrangementspåmeldinger
                            </FieldLabel>
                            <FieldDescription>
                                Navnet ditt vises i deltakerlister på
                                arrangementer. Skrur du av, står du oppført som
                                anonym for andre medlemmer. Arrangører ser deg
                                uansett.
                            </FieldDescription>
                        </FieldContent>
                        <Switch
                            id="public-registrations"
                            checked={publicRegistrations}
                            disabled={updateSettings.isPending}
                            onCheckedChange={handlePublicRegistrationsChange}
                        />
                    </Field>
                    {updateSettings.isError ? (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>
                                Innstillingen ble ikke lagret
                            </AlertTitle>
                            <AlertDescription>
                                Prøv på nytt. Står det seg, gi beskjed til
                                TIHLDE.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </CardContent>
            </Card>
            <AllergiesCard />
        </div>
    );
}

/**
 * Allergiene medlemmet oppgir om seg selv.
 *
 * Egen komponent framfor enda et felt i Personvern-kortet: dette er den eneste
 * seksjonen med et lagre-steg, fordi et halvskrevet fritekstfelt ikke skal
 * sendes av gårde slik bryterne gjør.
 */
function AllergiesCard() {
    const { data: session } = useQuery(authQueryOptions);
    const { data: catalogue } = useQuery(getAllergiesQuery({ curated: true }));
    const updateSettings = useMutation(updateUserSettingsMutation);

    const settings = session?.user.settings;
    const savedAllergies = settings?.allergies ?? [];
    const savedCustom = settings?.customAllergies ?? [];
    const hasAnswered = settings?.allergiesConfirmedAt != null;

    const [selection, setSelection] = useState<AllergySelection>({
        allergies: savedAllergies,
        customAllergies: savedCustom,
    });

    // Sesjonen lastes etter første render, så utvalget må følge etter når den
    // kommer inn. Nøkkelen sammenligner innhold, ikke referanse — arrayene er
    // nye objekter ved hver henting.
    const savedKey = `${savedAllergies.join(",")}|${savedCustom.join(",")}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: savedKey er
    // innholdssammenligningen; å avhenge av arrayene ville løpt hver render.
    useEffect(() => {
        setSelection({
            allergies: savedAllergies,
            customAllergies: savedCustom,
        });
    }, [savedKey]);

    const isDirty =
        savedKey !==
        `${selection.allergies.join(",")}|${selection.customAllergies.join(",")}`;

    /**
     * Den som aldri har svart må kunne lagre selv om ingenting er endret —
     * ellers er «ingen allergier» umulig å registrere: utvalget er tomt fra
     * før, så knappen ville stått grå for nettopp de brukerne svaret gjelder.
     */
    const canSave = isDirty || !hasAnswered;

    async function handleSave() {
        await updateSettings.mutateAsync({
            data: {
                allergies: selection.allergies,
                customAllergies: selection.customAllergies,
            },
        });
        // Allergiene leses av sesjonen, ikke av en egen spørring.
        await invalidateAuth();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Allergier</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Field>
                    <FieldContent>
                        <FieldLabel>Mine allergier</FieldLabel>
                        <FieldDescription>
                            Velg fra lista, eller skriv inn dine egne. Deles med
                            arrangøren for arrangementer du melder deg på, slik
                            at de kan ta hensyn til det når de bestiller mat.
                        </FieldDescription>
                    </FieldContent>
                </Field>

                <AllergyPicker
                    options={catalogue ?? []}
                    value={selection}
                    onChange={setSelection}
                    disabled={updateSettings.isPending}
                />

                {!hasAnswered ? (
                    <p className="text-sm text-muted-foreground">
                        Om du ikke har noen allergier, lagrer du bare med tomt
                        felt.
                    </p>
                ) : null}

                <div>
                    <Button
                        type="button"
                        disabled={!canSave || updateSettings.isPending}
                        onClick={handleSave}
                    >
                        Lagre allergier
                    </Button>
                </div>

                {updateSettings.isError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Allergiene ble ikke lagret</AlertTitle>
                        <AlertDescription>
                            Prøv på nytt. Står det seg, gi beskjed til TIHLDE.
                        </AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
        </Card>
    );
}
