import { addHours } from "date-fns";
import { nb } from "date-fns/locale";
import { useEffect, useState } from "react";

import { RichEditor } from "@tihlde/ui/complex/markdown";
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

import type { AddressSuggestion } from "#/api/queries/address";
import { AddressCombobox } from "#/components/address-combobox";
import { AdminImageField } from "#/components/admin-image-field";
import { richRegistry } from "#/components/markdown/directives/presets";
import { nextWholeHour } from "#/lib/date";

/** Sentinel for "no institute restriction" — Select has no empty value. */
export const ALL_INSTITUTES = "all";

/**
 * The event fields this form owns. Everything else on an event (priority
 * pools, contact person, …) is left untouched by create and update alike.
 */
export type EventFormValues = {
    title: string;
    description: string;
    categorySlug: string;
    organizerGroupSlug: string;
    location: string;
    locationLat: number | null;
    locationLng: number | null;
    start: string;
    end: string;
    registrationEnd: string;
    capacity: number | null;
    visibility: "public" | "members";
    restrictedToInstituteSlug: string | null;
    isPaidEvent: boolean;
    price: number | null;
    canCauseStrikes: boolean;
    imageAlt: string | null;
};

export type EventFormInitialValues = Partial<
    Omit<EventFormValues, "start" | "end" | "registrationEnd">
> & {
    start?: string | null;
    end?: string | null;
    registrationEnd?: string | null;
};

type EventFormProps = {
    groups: Array<{ slug: string; name: string }>;
    institutes: Array<{ slug: string; name: string; shortName: string }>;
    initialValues?: EventFormInitialValues;
    /** Existing cover image, shown as a preview when editing. */
    existingImageUrl?: string | null;
    submitLabel: string;
    isSubmitting?: boolean;
    submitDisabledLabel?: string;
    /** Address suggestions for the current location text, fetched by the route. */
    addressSuggestions?: AddressSuggestion[];
    isSearchingAddress?: boolean;
    /** Fires whenever the location text changes, so the route can search. */
    onAddressQueryChange?: (query: string) => void;
    /**
     * Called with the collected values and the newly picked image file, if
     * any. Uploading the file and calling the API is the caller's job.
     */
    onSubmit: (values: EventFormValues, image: File | null) => void;
    /** Rendered between the last card and the submit button. */
    children?: React.ReactNode;
    /** Extra actions rendered next to the submit button (e.g. delete). */
    actions?: React.ReactNode;
};

/** Date -> ISO string, or null when unset */
function toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
}

function toDate(value: string | null | undefined): Date | null {
    return value ? new Date(value) : null;
}

/**
 * Sensible defaults for a new event: start on the next whole hour, end two
 * hours later, and registration closing when the event starts.
 */
function eventDateDefaults() {
    const start = nextWholeHour();
    return { start, end: addHours(start, 2), registrationEnd: start };
}

export function EventForm({
    groups,
    institutes,
    initialValues,
    existingImageUrl,
    submitLabel,
    isSubmitting,
    submitDisabledLabel,
    addressSuggestions,
    isSearchingAddress,
    onAddressQueryChange,
    onSubmit,
    children,
    actions,
}: EventFormProps) {
    const [title, setTitle] = useState(initialValues?.title ?? "");
    const [description, setDescription] = useState(
        initialValues?.description ?? "",
    );
    const [categorySlug, setCategorySlug] = useState(
        initialValues?.categorySlug ?? "",
    );
    const [organizerGroupSlug, setOrganizerGroupSlug] = useState(
        initialValues?.organizerGroupSlug ?? "",
    );
    const [location, setLocation] = useState(initialValues?.location ?? "");
    // Coordinates are only set when the place was picked from the address
    // search. Free text ("Digitalt", "R1") gives null, and then the place is
    // shown without a map link.
    const [locationCoords, setLocationCoords] = useState<{
        label: string;
        lat: number;
        lng: number;
    } | null>(
        initialValues?.locationLat != null && initialValues?.locationLng != null
            ? {
                  label: initialValues.location ?? "",
                  lat: initialValues.locationLat,
                  lng: initialValues.locationLng,
              }
            : null,
    );
    const [start, setStart] = useState<Date | null>(
        toDate(initialValues?.start),
    );
    const [end, setEnd] = useState<Date | null>(toDate(initialValues?.end));
    const [registrationEnd, setRegistrationEnd] = useState<Date | null>(
        toDate(initialValues?.registrationEnd),
    );
    const [capacity, setCapacity] = useState(
        initialValues?.capacity != null ? String(initialValues.capacity) : "",
    );
    const [visibility, setVisibility] = useState<"public" | "members">(
        initialValues?.visibility ?? "public",
    );
    const [instituteSlug, setInstituteSlug] = useState(
        initialValues?.restrictedToInstituteSlug ?? ALL_INSTITUTES,
    );
    const [isPaidEvent, setIsPaidEvent] = useState(
        initialValues?.isPaidEvent ?? false,
    );
    const [canCauseStrikes, setCanCauseStrikes] = useState(
        initialValues?.canCauseStrikes ?? false,
    );
    const [price, setPrice] = useState(
        initialValues?.price != null ? String(initialValues.price) : "",
    );
    const [image, setImage] = useState<File | null>(null);
    const [imageAlt, setImageAlt] = useState(initialValues?.imageAlt ?? "");

    // Default dates are set on the client to avoid an SSR hydration mismatch.
    const hasInitialDates = Boolean(initialValues?.start);
    useEffect(() => {
        if (hasInitialDates) return;
        const defaults = eventDateDefaults();
        setStart((current) => current ?? defaults.start);
        setEnd((current) => current ?? defaults.end);
        setRegistrationEnd((current) => current ?? defaults.registrationEnd);
    }, [hasInitialDates]);

    /**
     * Coordinates follow the text: as soon as the user edits a chosen address
     * suggestion they are no longer valid for what the field now says.
     */
    function handleLocationChange(next: string) {
        setLocation(next);
        onAddressQueryChange?.(next);
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

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const startIso = toIso(start);
        const endIso = toIso(end);
        const registrationEndIso = toIso(registrationEnd);
        if (!startIso || !endIso || !registrationEndIso) return;

        onSubmit(
            {
                title,
                description,
                categorySlug,
                organizerGroupSlug,
                location,
                locationLat: locationCoords?.lat ?? null,
                locationLng: locationCoords?.lng ?? null,
                start: startIso,
                end: endIso,
                registrationEnd: registrationEndIso,
                capacity: capacity ? Number(capacity) : null,
                visibility,
                restrictedToInstituteSlug:
                    instituteSlug === ALL_INSTITUTES ? null : instituteSlug,
                isPaidEvent,
                price: isPaidEvent && price ? Number(price) : null,
                canCauseStrikes,
                imageAlt: imageAlt || null,
            },
            image,
        );
    }

    return (
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
                                onChange={(e) => setTitle(e.target.value)}
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
                                onChange={(e) =>
                                    setCategorySlug(e.target.value)
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
                                isSearching={isSearchingAddress ?? false}
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
                                onChange={(e) => setCapacity(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="event-visibility">
                                Synlighet
                            </FieldLabel>
                            <Select
                                items={[
                                    { value: "public", label: "Offentlig" },
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
                                    setInstituteSlug(value ?? ALL_INSTITUTES)
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
                                Begrenser påmelding til studenter ved dette
                                instituttet.
                            </FieldDescription>
                        </Field>
                        <Field orientation="horizontal" className="gap-3">
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
                                    onChange={(e) => setPrice(e.target.value)}
                                />
                            </Field>
                        )}
                        <Field orientation="horizontal" className="gap-3">
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
                            existingImageUrl={existingImageUrl ?? undefined}
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
                                onChange={(e) => setImageAlt(e.target.value)}
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            {children}

            <div className="flex justify-end gap-2">
                {actions}
                <Button
                    type="submit"
                    disabled={isSubmitting || !organizerGroupSlug}
                >
                    {isSubmitting && submitDisabledLabel
                        ? submitDisabledLabel
                        : submitLabel}
                </Button>
            </div>
        </form>
    );
}
