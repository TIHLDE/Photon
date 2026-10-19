import {
    authQueryOptions,
    invalidateAuth,
    requireOwnProfile,
} from "#/api/auth";
import {
    getAllergiesQuery,
    updateUserSettingsMutation,
} from "#/api/queries/user";
import { EditAllergiesDialog } from "#/components/edit-allergies-dialog";
import { EVENT_RULES_URL } from "#/components/event-rules-consent";
import { useSaveAllergies } from "#/hooks/use-save-allergies";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Switch } from "@tihlde/ui/ui/switch";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Suspense } from "react";

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
            <EventRulesCard />
            <Suspense fallback={<AllergiesCardSkeleton />}>
                <AllergiesCard />
            </Suspense>
        </div>
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
 * Kortet viser bare lagrede opplysninger. Utkastet lever i redigeringsdialogen.
 */
function AllergiesCard() {
    const { data: session } = useSuspenseQuery(authQueryOptions);
    const { data: catalogue } = useSuspenseQuery(
        getAllergiesQuery({ curated: true }),
    );
    const saveAllergies = useSaveAllergies();

    const settings = session?.user.settings;
    const savedAllergies = settings?.allergies ?? [];
    const savedCustom = settings?.customAllergies ?? [];
    const hasAnswered = settings?.allergiesConfirmedAt != null;

    const hasAllergies = savedAllergies.length + savedCustom.length > 0;
    const labels = new Map(
        catalogue.map((option) => [option.slug, option.label]),
    );

    return (
        <Card id="allergier" className="scroll-mt-20">
            <CardHeader>
                <CardTitle>Allergier</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Deles med arrangøren for arrangementer du melder deg på,
                    slik at de kan ta hensyn når de bestiller mat.
                </p>
                {!hasAnswered ? (
                    <Badge variant="outline">Ikke besvart</Badge>
                ) : null}
                {hasAllergies ? (
                    <div className="flex flex-wrap gap-2">
                        {savedAllergies.map((slug) => (
                            <Badge key={slug} variant="secondary">
                                {labels.get(slug) ?? slug}
                            </Badge>
                        ))}
                        {savedCustom.map((label) => (
                            <Badge key={`custom:${label}`} variant="secondary">
                                {label}
                            </Badge>
                        ))}
                    </div>
                ) : hasAnswered ? (
                    <p className="text-sm">Ingen allergier</p>
                ) : null}
                <div>
                    <EditAllergiesDialog
                        defaultValues={{
                            allergies: savedAllergies,
                            customAllergies: savedCustom,
                        }}
                        hasAnswered={hasAnswered}
                        options={catalogue}
                        onSubmit={saveAllergies.save}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function AllergiesCardSkeleton() {
    return (
        <Card id="allergier" className="scroll-mt-20">
            <CardHeader>
                <CardTitle>Allergier</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-24" />
            </CardContent>
        </Card>
    );
}
