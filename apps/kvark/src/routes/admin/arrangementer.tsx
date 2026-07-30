import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { addHours } from "date-fns";

import { RichEditor } from "@tihlde/ui/complex/markdown";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { DateTimePicker } from "@tihlde/ui/ui/date-time-picker";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { CheckCircle2, XCircle } from "lucide-react";
import { nb } from "date-fns/locale";

import type { AddressSuggestion } from "#/api/queries/address";
import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import { createEventMutation } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AddressCombobox } from "#/components/address-combobox";
import { AdminImageField } from "#/components/admin-image-field";
import { AdminNoAccess } from "#/components/admin-no-access";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { richRegistry } from "#/components/markdown/directives/presets";
import { nextWholeHour } from "#/lib/date";
import { useDebounced } from "#/lib/use-debounced";

export const Route = createFileRoute("/admin/arrangementer")({
    component: EventAdminPage,
    loader: ({ context }) =>
        Promise.all([
            context.queryClient.ensureQueryData(getGroupsQuery(0)),
            context.queryClient.ensureQueryData(getInstitutesQuery()),
        ]),
});

/** Sentinel for "no institute restriction" — Select has no empty value. */
const ALL_INSTITUTES = "all";

/** Date -> ISO string, or null when unset */
function toIso(value: Date | null): string | null {
    if (!value) return null;
    return value.toISOString();
}

/**
 * Fornuftige standardverdier for et nytt arrangement: start på neste hele
 * time, slutt to timer senere, og påmelding som lukkes når arrangementet
 * starter.
 */
function eventDateDefaults() {
    const start = nextWholeHour();
    return { start, end: addHours(start, 2), registrationEnd: start };
}

function EventAdminPage() {
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [categorySlug, setCategorySlug] = useState("");
    const [organizerGroupSlug, setOrganizerGroupSlug] = useState("");
    const [location, setLocation] = useState("");
    // Koordinater settes kun når stedet er valgt fra adressesøket. Fritekst
    // ("Digitalt", "R1") gir null, og da vises stedet uten kartlenke.
    const [locationCoords, setLocationCoords] = useState<{
        label: string;
        lat: number;
        lng: number;
    } | null>(null);
    const debouncedLocation = useDebounced(location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));
    const [start, setStart] = useState<Date | null>(null);
    const [end, setEnd] = useState<Date | null>(null);
    const [registrationEnd, setRegistrationEnd] = useState<Date | null>(null);
    const [capacity, setCapacity] = useState("");
    const [visibility, setVisibility] = useState<"public" | "members">(
        "public",
    );
    const [instituteSlug, setInstituteSlug] = useState(ALL_INSTITUTES);
    const [isPaidEvent, setIsPaidEvent] = useState(false);
    const [canCauseStrikes, setCanCauseStrikes] = useState(false);
    const [price, setPrice] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imageAlt, setImageAlt] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Sett standardverdier på klienten for å unngå SSR-hydration-mismatch.
    useEffect(() => {
        const defaults = eventDateDefaults();
        setStart((current) => current ?? defaults.start);
        setEnd((current) => current ?? defaults.end);
        setRegistrationEnd((current) => current ?? defaults.registrationEnd);
    }, []);

    const createEvent = useMutation(createEventMutation);
    const { uploadImage, isUploading } = useImageUploader();

    /**
     * Koordinatene følger teksten: så snart brukeren redigerer et valgt
     * adresseforslag er de ikke lenger gyldige for stedet som står i feltet.
     */
    function handleLocationChange(next: string) {
        setLocation(next);
        setLocationCoords((current) =>
            current && current.label === next ? current : null,
        );
    }

    function handleSelectAddress(suggestion: AddressSuggestion) {
        setLocation(suggestion.label);
        setLocationCoords({
            label: suggestion.label,
            lat: suggestion.lat,
            lng: suggestion.lng,
        });
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);

        const startIso = toIso(start);
        const endIso = toIso(end);
        const registrationEndIso = toIso(registrationEnd);
        if (!startIso || !endIso || !registrationEndIso) return;

        // Uploaded first: a failed upload must not leave an event behind that
        // silently lost its cover.
        let imageUrl: string | null = null;
        if (image) {
            try {
                imageUrl = await uploadImage(image);
            } catch (err) {
                setUploadError(
                    err instanceof Error ? err.message : String(err),
                );
                return;
            }
        }

        createEvent.mutate(
            {
                data: {
                    title,
                    description,
                    categorySlug,
                    organizerGroupSlug,
                    location,
                    locationLat: locationCoords?.lat ?? null,
                    locationLng: locationCoords?.lng ?? null,
                    imageUrl,
                    imageAlt: imageUrl ? imageAlt || null : null,
                    start: startIso,
                    end: endIso,
                    registrationStart: null,
                    registrationEnd: registrationEndIso,
                    cancellationDeadline: null,
                    capacity: capacity ? Number(capacity) : null,
                    visibility,
                    restrictedToInstituteSlug:
                        instituteSlug === ALL_INSTITUTES ? null : instituteSlug,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes,
                    enforcesPreviousStrikes: canCauseStrikes,
                    isPaidEvent,
                    price: isPaidEvent && price ? Number(price) : null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: false,
                },
            },
            {
                onSuccess() {
                    setTitle("");
                    setDescription("");
                    setCategorySlug("");
                    setOrganizerGroupSlug("");
                    setLocation("");
                    setLocationCoords(null);
                    const defaults = eventDateDefaults();
                    setStart(defaults.start);
                    setEnd(defaults.end);
                    setRegistrationEnd(defaults.registrationEnd);
                    setCapacity("");
                    setVisibility("public");
                    setInstituteSlug(ALL_INSTITUTES);
                    setIsPaidEvent(false);
                    setCanCauseStrikes(false);
                    setPrice("");
                    setImage(null);
                    setImageAlt("");
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nytt arrangement</h1>
                <p className="text-muted-foreground">
                    Beskrivelsen lagres som markdown og formateringen vises
                    direkte mens du skriver.
                </p>
            </div>

            {!canCreate ? (
                <AdminNoAccess action="opprette arrangementer" />
            ) : null}

            {canCreate ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detaljer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="event-title">
                                        Tittel
                                    </FieldLabel>
                                    <Input
                                        id="event-title"
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-category">
                                        Kategori (slug)
                                    </FieldLabel>
                                    <Input
                                        id="event-category"
                                        type="text"
                                        required
                                        value={categorySlug}
                                        onChange={(event) =>
                                            setCategorySlug(event.target.value)
                                        }
                                        placeholder="sosialt"
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-organizer">
                                        Arrangørgruppe
                                    </FieldLabel>
                                    <Select
                                        items={groups.map((group) => ({
                                            value: group.slug,
                                            label: group.name,
                                        }))}
                                        value={organizerGroupSlug}
                                        onValueChange={(value) =>
                                            setOrganizerGroupSlug(value ?? "")
                                        }
                                    >
                                        <SelectTrigger id="event-organizer">
                                            <SelectValue placeholder="Velg gruppe" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {groups.map((group) => (
                                                <SelectItem
                                                    key={group.slug}
                                                    value={group.slug}
                                                >
                                                    {group.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-location">
                                        Sted
                                    </FieldLabel>
                                    <AddressCombobox
                                        id="event-location"
                                        required
                                        value={location}
                                        onValueChange={handleLocationChange}
                                        suggestions={addressSuggestions ?? []}
                                        isSearching={isSearchingAddress}
                                        onSelectSuggestion={handleSelectAddress}
                                    />
                                    <FieldDescription>
                                        {locationCoords
                                            ? "Adressen er lenket til kart på arrangementssiden."
                                            : "Søk opp en adresse for å legge ved kartlenke, eller skriv fritt (f.eks. «Digitalt»)."}
                                    </FieldDescription>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-start">
                                        Starttidspunkt
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-start"
                                        locale={nb}
                                        placeholder="Velg starttidspunkt"
                                        value={start}
                                        onValueChange={setStart}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-end">
                                        Sluttidspunkt
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-end"
                                        locale={nb}
                                        placeholder="Velg sluttidspunkt"
                                        minDate={start ?? undefined}
                                        value={end}
                                        onValueChange={setEnd}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-reg-end">
                                        Påmeldingsfrist
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-reg-end"
                                        locale={nb}
                                        placeholder="Velg påmeldingsfrist"
                                        maxDate={start ?? undefined}
                                        value={registrationEnd}
                                        onValueChange={setRegistrationEnd}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-capacity">
                                        Kapasitet (valgfritt)
                                    </FieldLabel>
                                    <Input
                                        id="event-capacity"
                                        type="number"
                                        min={1}
                                        value={capacity}
                                        onChange={(event) =>
                                            setCapacity(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-visibility">
                                        Synlighet
                                    </FieldLabel>
                                    <Select
                                        items={[
                                            {
                                                value: "public",
                                                label: "Offentlig",
                                            },
                                            {
                                                value: "members",
                                                label: "Kun for medlemmer",
                                            },
                                        ]}
                                        value={visibility}
                                        onValueChange={(value) =>
                                            setVisibility(
                                                value === "members"
                                                    ? "members"
                                                    : "public",
                                            )
                                        }
                                    >
                                        <SelectTrigger id="event-visibility">
                                            <SelectValue placeholder="Velg synlighet" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="public">
                                                Offentlig
                                            </SelectItem>
                                            <SelectItem value="members">
                                                Kun for medlemmer
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-institute">
                                        Institutt
                                    </FieldLabel>
                                    <Select
                                        items={[
                                            {
                                                value: ALL_INSTITUTES,
                                                label: "Alle institutt",
                                            },
                                            ...institutes.map((institute) => ({
                                                value: institute.slug,
                                                label: institute.shortName,
                                            })),
                                        ]}
                                        value={instituteSlug}
                                        onValueChange={(value) =>
                                            setInstituteSlug(
                                                value ?? ALL_INSTITUTES,
                                            )
                                        }
                                    >
                                        <SelectTrigger id="event-institute">
                                            <SelectValue placeholder="Velg institutt" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_INSTITUTES}>
                                                Alle institutt
                                            </SelectItem>
                                            {institutes.map((institute) => (
                                                <SelectItem
                                                    key={institute.slug}
                                                    value={institute.slug}
                                                >
                                                    {institute.shortName} –{" "}
                                                    {institute.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        Begrenser påmelding til studenter ved
                                        dette instituttet.
                                    </FieldDescription>
                                </Field>
                                <Field
                                    orientation="horizontal"
                                    className="gap-3"
                                >
                                    <Checkbox
                                        id="event-paid"
                                        checked={isPaidEvent}
                                        onCheckedChange={(checked) =>
                                            setIsPaidEvent(Boolean(checked))
                                        }
                                    />
                                    <FieldLabel htmlFor="event-paid">
                                        Betalt arrangement
                                    </FieldLabel>
                                </Field>
                                {isPaidEvent && (
                                    <Field>
                                        <FieldLabel htmlFor="event-price">
                                            Pris (NOK)
                                        </FieldLabel>
                                        <Input
                                            id="event-price"
                                            type="number"
                                            min={0}
                                            value={price}
                                            onChange={(event) =>
                                                setPrice(event.target.value)
                                            }
                                        />
                                    </Field>
                                )}
                                <Field
                                    orientation="horizontal"
                                    className="gap-3"
                                >
                                    <Checkbox
                                        id="event-strikes"
                                        checked={canCauseStrikes}
                                        onCheckedChange={(checked) =>
                                            setCanCauseStrikes(Boolean(checked))
                                        }
                                    />
                                    <FieldLabel htmlFor="event-strikes">
                                        Kan gi prikker (avmelding etter frist og
                                        no-show)
                                    </FieldLabel>
                                </Field>
                                <Field>
                                    <FieldLabel>Beskrivelse</FieldLabel>
                                    <RichEditor
                                        registry={richRegistry}
                                        value={description}
                                        onChange={setDescription}
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Forsidebilde</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <AdminImageField
                                    label="Bilde"
                                    description="Vises på arrangementskortet og øverst på arrangementssiden. Forhåndsvisningen er samme utsnitt som besøkende ser."
                                    preset="cover-wide"
                                    value={image}
                                    onChange={setImage}
                                />
                                <Field>
                                    <FieldLabel htmlFor="event-image-alt">
                                        Bildebeskrivelse
                                    </FieldLabel>
                                    <Input
                                        id="event-image-alt"
                                        type="text"
                                        maxLength={255}
                                        placeholder="Kort beskrivelse for skjermlesere"
                                        value={imageAlt}
                                        onChange={(event) =>
                                            setImageAlt(event.target.value)
                                        }
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    {uploadError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                            <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                    )}
                    {createEvent.isSuccess && (
                        <Alert>
                            <CheckCircle2 className="size-4" />
                            <AlertTitle>Publisert</AlertTitle>
                            <AlertDescription>
                                Arrangementet ble opprettet.
                            </AlertDescription>
                        </Alert>
                    )}
                    {createEvent.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke publisere</AlertTitle>
                            <AlertDescription>
                                {createEvent.error.message}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={
                                createEvent.isPending ||
                                isUploading ||
                                !organizerGroupSlug
                            }
                        >
                            {isUploading ? "Laster opp bilde …" : "Publiser"}
                        </Button>
                    </div>
                </form>
            ) : null}
        </div>
    );
}
