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
import { nb } from "date-fns/locale";
import { useRef } from "react";
import type { FormEvent, ReactNode } from "react";

import type { AddressSuggestion } from "#/api/queries/address";
import { AddressCombobox } from "#/components/address-combobox";
import { AdminImageField } from "#/components/admin-image-field";
import { richRegistry } from "#/components/markdown/directives/presets";
import { ALL_EVENT_CATEGORIES } from "#/lib/event-categories";

/** Sentinel for "no institute restriction" — Select has no empty value. */
export const ALL_INSTITUTES = "all";

/** Samme grunn: Select trenger en verdi for «ingen kontaktperson». */
const NO_CONTACT = "none";

export type EventFormValues = {
    title: string;
    description: string;
    categorySlug: string;
    organizerGroupSlug: string;
    location: string;
    /**
     * Koordinater settes kun når stedet er valgt fra adressesøket. Fritekst
     * ("Digitalt", "R1") gir null, og da vises stedet uten kartlenke.
     */
    locationCoords: { label: string; lat: number; lng: number } | null;
    /** Bruker-ID til den som skal svare på spørsmål. Tom streng = ingen valgt. */
    contactPersonUserId: string;
    start: Date | null;
    end: Date | null;
    /** Om arrangementet har påmelding i det hele tatt. */
    requiresSigningUp: boolean;
    /** Når påmeldingen åpner. */
    registrationStart: Date | null;
    registrationEnd: Date | null;
    capacity: string;
    visibility: "public" | "members";
    instituteSlug: string;
    isPaidEvent: boolean;
    canCauseStrikes: boolean;
    price: string;
    image: File | null;
    imageAlt: string;
};

type EventFormProps = {
    values: EventFormValues;
    onChange: (patch: Partial<EventFormValues>) => void;
    groups: Array<{ slug: string; name: string }>;
    institutes: Array<{ slug: string; shortName: string; name: string }>;
    /** Medlemmene i den valgte arrangørgruppen — kandidatene til kontaktperson. */
    contactPersonCandidates: Array<{ id: string; name: string }>;
    addressSuggestions: AddressSuggestion[];
    isSearchingAddress: boolean;
    /** Bilde som allerede ligger på arrangementet, vist til et nytt velges. */
    existingImageUrl?: string | null;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    submitLabel: string;
    isSubmitting: boolean;
    /** Knapp som legger seg til venstre for lagreknappen, f.eks. slett. */
    secondaryAction?: ReactNode;
    /** Statusmeldinger som vises rett over knappen. */
    children?: ReactNode;
};

/**
 * Skjemaet for å opprette og redigere arrangementer. Feltverdiene eies av
 * ruten som bruker skjemaet, slik at både nytt arrangement og redigering
 * deler nøyaktig de samme feltene og valideringen.
 */
export function EventForm({
    values,
    onChange,
    groups,
    institutes,
    contactPersonCandidates,
    addressSuggestions,
    isSearchingAddress,
    existingImageUrl,
    onSubmit,
    submitLabel,
    isSubmitting,
    secondaryAction,
    children,
}: EventFormProps) {
    /** Sist valgte adresse, se `handleLocationChange`. */
    const selectedAddressRef = useRef<EventFormValues["locationCoords"]>(null);

    /**
     * Koordinatene følger teksten: så snart brukeren redigerer et valgt
     * adresseforslag er de ikke lenger gyldige for stedet som står i feltet.
     *
     * Adressefeltet fyller seg selv med etiketten når et forslag velges, så
     * dette kjører rett etter `handleSelectAddress` med samme tekst. `values`
     * er da fortsatt forrige render, og koordinatene ville blitt kastet med én
     * gang — derfor ligger det sist valgte forslaget i en ref også.
     */
    function handleLocationChange(next: string) {
        const selected =
            values.locationCoords?.label === next
                ? values.locationCoords
                : selectedAddressRef.current?.label === next
                  ? selectedAddressRef.current
                  : null;

        onChange({ location: next, locationCoords: selected });
    }

    /**
     * Kandidatene er medlemmene i arrangørgruppen. En kontaktperson som er
     * lagret fra før, men ikke lenger står i lista — f.eks. etter et
     * lederskifte — legges til, slik at redigering ikke stille nullstiller
     * feltet.
     */
    const contactPersonOptions = [
        { value: NO_CONTACT, label: "Ingen kontaktperson" },
        ...contactPersonCandidates.map((member) => ({
            value: member.id,
            label: member.name,
        })),
        ...(values.contactPersonUserId &&
        !contactPersonCandidates.some(
            (member) => member.id === values.contactPersonUserId,
        )
            ? [
                  {
                      value: values.contactPersonUserId,
                      label: "Nåværende kontaktperson",
                  },
              ]
            : []),
    ];

    /**
     * Kapasitet, synlighet og institutt deler én rad på fire kolonner, der
     * kapasitet er like bred som en tidsvelger over. Uten påmelding faller
     * kapasitet bort, og de to andre fyller raden i stedet for å la halve
     * bredden stå tom.
     */
    const wideWhenNoCapacity = values.requiresSigningUp
        ? undefined
        : "lg:col-span-2";

    function handleSelectAddress(suggestion: AddressSuggestion) {
        const coords = {
            label: suggestion.label,
            lat: suggestion.lat,
            lng: suggestion.lng,
        };
        selectedAddressRef.current = coords;
        onChange({ location: suggestion.label, locationCoords: coords });
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Detaljer</CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="event-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="event-title"
                                    type="text"
                                    required
                                    value={values.title}
                                    onChange={(event) =>
                                        onChange({ title: event.target.value })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="event-category">
                                    Kategori
                                </FieldLabel>
                                <Select
                                    items={ALL_EVENT_CATEGORIES}
                                    value={values.categorySlug}
                                    onValueChange={(value) =>
                                        onChange({ categorySlug: value ?? "" })
                                    }
                                >
                                    <SelectTrigger id="event-category">
                                        <SelectValue placeholder="Velg kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALL_EVENT_CATEGORIES.map(
                                            (category) => (
                                                <SelectItem
                                                    key={category.value}
                                                    value={category.value}
                                                >
                                                    {category.label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="event-organizer">
                                    Arrangørgruppe
                                </FieldLabel>
                                <Select
                                    items={groups.map((group) => ({
                                        value: group.slug,
                                        label: group.name,
                                    }))}
                                    value={values.organizerGroupSlug}
                                    onValueChange={(value) =>
                                        onChange({
                                            organizerGroupSlug: value ?? "",
                                        })
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
                                <FieldLabel htmlFor="event-contact">
                                    Kontaktperson (valgfritt)
                                </FieldLabel>
                                <Select
                                    items={contactPersonOptions}
                                    value={
                                        values.contactPersonUserId || NO_CONTACT
                                    }
                                    onValueChange={(value) =>
                                        onChange({
                                            contactPersonUserId:
                                                !value || value === NO_CONTACT
                                                    ? ""
                                                    : value,
                                        })
                                    }
                                >
                                    <SelectTrigger id="event-contact">
                                        <SelectValue placeholder="Ingen kontaktperson" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contactPersonOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    Vises på arrangementssiden, med e-post for
                                    innloggede medlemmer. Velg blant medlemmene
                                    i arrangørgruppen.
                                </FieldDescription>
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel htmlFor="event-location">
                                Sted
                            </FieldLabel>
                            <AddressCombobox
                                id="event-location"
                                required
                                value={values.location}
                                onValueChange={handleLocationChange}
                                suggestions={addressSuggestions}
                                isSearching={isSearchingAddress}
                                onSelectSuggestion={handleSelectAddress}
                            />
                            <FieldDescription>
                                {values.locationCoords
                                    ? "Adressen er lenket til kart på arrangementssiden."
                                    : "Søk opp en adresse for å legge ved kartlenke, eller skriv fritt (f.eks. «Digitalt»)."}
                            </FieldDescription>
                        </Field>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="event-start">
                                    Starttidspunkt
                                </FieldLabel>
                                <DateTimePicker
                                    id="event-start"
                                    locale={nb}
                                    placeholder="Velg startdato"
                                    value={values.start}
                                    onValueChange={(start) =>
                                        onChange({ start })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="event-end">
                                    Sluttidspunkt
                                </FieldLabel>
                                <DateTimePicker
                                    id="event-end"
                                    locale={nb}
                                    placeholder="Velg sluttdato"
                                    minDate={values.start ?? undefined}
                                    value={values.end}
                                    onValueChange={(end) => onChange({ end })}
                                />
                            </Field>
                        </div>
                        <Field orientation="horizontal" className="gap-3">
                            <Checkbox
                                id="event-requires-signup"
                                checked={values.requiresSigningUp}
                                onCheckedChange={(checked) =>
                                    onChange({
                                        requiresSigningUp: Boolean(checked),
                                    })
                                }
                            />
                            <FieldLabel htmlFor="event-requires-signup">
                                Arrangementet har påmelding
                            </FieldLabel>
                        </Field>
                        {values.requiresSigningUp ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Field>
                                    <FieldLabel htmlFor="event-reg-start">
                                        Påmelding åpner
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-reg-start"
                                        locale={nb}
                                        placeholder="Velg dato"
                                        maxDate={
                                            values.registrationEnd ??
                                            values.start ??
                                            undefined
                                        }
                                        value={values.registrationStart}
                                        onValueChange={(registrationStart) =>
                                            onChange({ registrationStart })
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="event-reg-end">
                                        Påmeldingsfrist
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-reg-end"
                                        locale={nb}
                                        placeholder="Velg dato"
                                        minDate={
                                            values.registrationStart ??
                                            undefined
                                        }
                                        maxDate={values.start ?? undefined}
                                        value={values.registrationEnd}
                                        onValueChange={(registrationEnd) =>
                                            onChange({ registrationEnd })
                                        }
                                    />
                                </Field>
                            </div>
                        ) : null}
                        <div className="grid gap-4 lg:grid-cols-4">
                            {values.requiresSigningUp ? (
                                <Field className="lg:col-span-2">
                                    <FieldLabel htmlFor="event-capacity">
                                        Kapasitet (valgfritt)
                                    </FieldLabel>
                                    <Input
                                        id="event-capacity"
                                        type="number"
                                        min={1}
                                        value={values.capacity}
                                        onChange={(event) =>
                                            onChange({
                                                capacity: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            ) : null}
                            <Field className={wideWhenNoCapacity}>
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
                                    value={values.visibility}
                                    onValueChange={(value) =>
                                        onChange({
                                            visibility:
                                                value === "members"
                                                    ? "members"
                                                    : "public",
                                        })
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
                            <Field className={wideWhenNoCapacity}>
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
                                    value={values.instituteSlug}
                                    onValueChange={(value) =>
                                        onChange({
                                            instituteSlug:
                                                value ?? ALL_INSTITUTES,
                                        })
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
                        </div>
                        <Field orientation="horizontal" className="gap-3">
                            <Checkbox
                                id="event-paid"
                                checked={values.isPaidEvent}
                                onCheckedChange={(checked) =>
                                    onChange({ isPaidEvent: Boolean(checked) })
                                }
                            />
                            <FieldLabel htmlFor="event-paid">
                                Betalt arrangement
                            </FieldLabel>
                        </Field>
                        {values.isPaidEvent && (
                            <Field>
                                <FieldLabel htmlFor="event-price">
                                    Pris (NOK)
                                </FieldLabel>
                                <Input
                                    id="event-price"
                                    type="number"
                                    min={0}
                                    value={values.price}
                                    onChange={(event) =>
                                        onChange({ price: event.target.value })
                                    }
                                />
                            </Field>
                        )}
                        <Field orientation="horizontal" className="gap-3">
                            <Checkbox
                                id="event-strikes"
                                checked={values.canCauseStrikes}
                                onCheckedChange={(checked) =>
                                    onChange({
                                        canCauseStrikes: Boolean(checked),
                                    })
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
                                value={values.description}
                                onChange={(description) =>
                                    onChange({ description })
                                }
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
                            value={values.image}
                            onChange={(image) => onChange({ image })}
                            existingImageUrl={existingImageUrl}
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
                                value={values.imageAlt}
                                onChange={(event) =>
                                    onChange({ imageAlt: event.target.value })
                                }
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>

            {children}

            <div className="flex justify-end gap-2">
                {secondaryAction}
                <Button
                    type="submit"
                    disabled={isSubmitting || !values.organizerGroupSlug}
                >
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
