import {
    authQueryOptions,
    invalidateAuth,
    requireOwnProfile,
} from "#/api/auth";
import { useImageUploader } from "#/api/queries/assets";
import {
    getAllergiesQuery,
    getUserProfileQuery,
    updateUserSettingsMutation,
} from "#/api/queries/user";
import {
    AllergyPicker,
    type AllergySelection,
} from "#/components/allergy-picker";
import { EditProfileCard } from "#/components/edit-profile-card";
import { EVENT_RULES_URL } from "#/components/event-rules-consent";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@tihlde/ui/ui/skeleton";
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
            <ProfileCard />
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
            <EventRulesCard />
            <AllergiesCard />
        </div>
    );
}

/**
 * Profilbilde, beskrivelse og lenker — det andre ser på profilen. Lå før i en
 * dialog bak «Rediger profil» i headeren.
 */
function ProfileCard() {
    const { id } = Route.useParams();
    // Bildet som vises kommer fra profilen: den faller tilbake på Feide-bildet
    // når medlemmet ikke har lastet opp sitt eget.
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const updateSettings = useMutation(updateUserSettingsMutation);
    const { uploadImage } = useImageUploader();

    // Skjemaet fylles fra sesjonen. Vises det før den er lastet, kan medlemmet
    // begynne å skrive i tomme felt — og lagringen tømmer da lenkene som
    // allerede ligger der.
    if (!session) return <Skeleton className="h-96 w-full" />;

    const settings = session.user.settings;

    return (
        <EditProfileCard
            name={profile.name}
            imageUrl={profile.image ?? null}
            // Bare et eget opplastet bilde kan fjernes: uten ett faller
            // profilen tilbake på bildet Feide leverer.
            hasCustomImage={Boolean(settings?.imageUrl)}
            defaultValues={{
                bio: settings?.bioDescription ?? "",
                github: settings?.githubUrl ?? "",
                linkedin: settings?.linkedinUrl ?? "",
            }}
            onSubmit={async (values) => {
                // Bildet lastes opp først: feiler det, er ingenting lagret, og
                // medlemmet kan prøve på nytt uten at halve endringen allerede
                // ligger der.
                let imageUrl: string | undefined;
                if (values.imageFile) {
                    imageUrl = await uploadImage(values.imageFile);
                } else if (values.removeImage) {
                    // Tom streng er «fjern bildet»; `undefined` ville bare
                    // betydd «ikke endre».
                    imageUrl = "";
                }

                try {
                    await updateSettings.mutateAsync({
                        data: {
                            // Tomme strenger må sendes med — `undefined`
                            // betyr «ikke endre», så feltene kunne aldri tømmes
                            // igjen. API-et lagrer tomt som NULL.
                            bioDescription: values.bio,
                            githubUrl: values.github,
                            linkedinUrl: values.linkedin,
                            ...(imageUrl === undefined ? {} : { imageUrl }),
                        },
                    });
                } catch (error) {
                    // Kortet viser denne teksten. HTTP-feilen fra klienten
                    // sier «Request failed with status code 400», som ikke
                    // hjelper et medlem.
                    throw new Error("Fikk ikke lagret profilen. Prøv igjen.", {
                        cause: error,
                    });
                }
                await invalidateAuth();
            }}
        />
    );
}

/**
 * Godkjenningen av arrangementsreglene — samme felt som varselet på
 * arrangementssiden skriver til. Her kan medlemmet ta den unna i forkant, og
 * også trekke den igjen; varselet dukker da opp neste gang de skal melde seg
 * på. Egen mutasjon slik at en feil her ikke slår ut i Personvern-kortet.
 */
function EventRulesCard() {
    const { data: session } = useQuery(authQueryOptions);
    const updateSettings = useMutation(updateUserSettingsMutation);

    const acceptsEventRules =
        session?.user.settings?.acceptsEventRules ?? false;

    async function handleChange(checked: boolean) {
        await updateSettings.mutateAsync({
            data: { acceptsEventRules: checked },
        });
        // Godkjenningen leses fra sesjonen, både her og på arrangementssiden.
        await invalidateAuth();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Arrangementer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Field orientation="horizontal">
                    <FieldContent>
                        <FieldLabel htmlFor="accepts-event-rules">
                            Arrangementsreglene
                        </FieldLabel>
                        <FieldDescription>
                            Må være godkjent før du kan melde deg på
                            arrangementer. Gjør du det her, er du klar når
                            påmeldingen åpner.
                        </FieldDescription>
                        <div>
                            <Button
                                size="sm"
                                variant="link"
                                render={
                                    <a
                                        href={EVENT_RULES_URL}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                    />
                                }
                            >
                                Les reglene
                            </Button>
                        </div>
                    </FieldContent>
                    <Switch
                        id="accepts-event-rules"
                        checked={acceptsEventRules}
                        disabled={updateSettings.isPending}
                        onCheckedChange={handleChange}
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

    async function handleSave(next: AllergySelection) {
        try {
            await updateSettings.mutateAsync({
                data: {
                    allergies: next.allergies,
                    customAllergies: next.customAllergies,
                },
            });
            // Allergiene leses av sesjonen, ikke av en egen spørring.
            await invalidateAuth();
        } catch {
            // Feilen vises fra `updateSettings.isError`. Fanges likevel, ellers
            // blir et mislykket lagringsforsøk en ubehandlet rejection.
        }
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

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={updateSettings.isPending}
                        onClick={() => handleSave(selection)}
                    >
                        Lagre allergier
                    </Button>
                    {/* «Ingen allergier» var å lagre et tomt felt — et svar
                        ingen gjettet at de kunne gi. Nå er det en knapp, og
                        den forsvinner så snart spørsmålet er besvart. */}
                    {!hasAnswered ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={updateSettings.isPending}
                            onClick={() =>
                                handleSave({
                                    allergies: [],
                                    customAllergies: [],
                                })
                            }
                        >
                            Jeg har ingen
                        </Button>
                    ) : null}
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
