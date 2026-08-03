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
import type { FormEvent, ReactNode } from "react";

import type { AddressSuggestion } from "#/api/queries/address";
import { AddressCombobox } from "#/components/address-combobox";
import { AdminImageField } from "#/components/admin-image-field";
import { richRegistry } from "#/components/markdown/directives/presets";

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
    children,
}: EventFormProps) {
    /**
     * Koordinatene følger teksten: så snart brukeren redigerer et valgt
     * adresseforslag er de ikke lenger gyldige for stedet som står i feltet.
     */
    function handleLocationChange(next: string) {
        onChange({
            location: next,
            locationCoords:
                values.locationCoords && values.locationCoords.label === next
                    ? values.locationCoords
                    : null,
        });
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

    function handleSelectAddress(suggestion: AddressSuggestion) {
        onChange({
            location: suggestion.label,
            locationCoords: {
                label: suggestion.label,
                lat: suggestion.lat,
                lng: suggestion.lng,
            },
        });
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
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
                                value={values.title}
                                onChange={(event) =>
                                    onChange({ title: event.target.value })
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
                                value={values.categorySlug}
                                onChange={(event) =>
                                    onChange({
                                        categorySlug: event.target.value,
                                    })
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
                                value={values.contactPersonUserId || NO_CONTACT}
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
                                innloggede medlemmer. Velg blant medlemmene i
                                arrangørgruppen.
                            </FieldDescription>
                        </Field>
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
                        <Field>
                            <FieldLabel htmlFor="event-start">
                                Starttidspunkt
                            </FieldLabel>
                            <DateTimePicker
                                id="event-start"
                                locale={nb}
                                placeholder="Velg starttidspunkt"
                                value={values.start}
                                onValueChange={(start) => onChange({ start })}
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
                                minDate={values.start ?? undefined}
                                value={values.end}
                                onValueChange={(end) => onChange({ end })}
                            />
                        </Field>
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
                            <>
                                <Field>
                                    <FieldLabel htmlFor="event-reg-end">
                                        Påmeldingsfrist
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="event-reg-end"
                                        locale={nb}
                                        placeholder="Velg påmeldingsfrist"
                                        maxDate={values.start ?? undefined}
                                        value={values.registrationEnd}
                                        onValueChange={(registrationEnd) =>
                                            onChange({ registrationEnd })
                                        }
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
                                        value={values.capacity}
                                        onChange={(event) =>
                                            onChange({
                                                capacity: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </>
                        ) : null}
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
                                value={values.instituteSlug}
                                onValueChange={(value) =>
                                    onChange({
                                        instituteSlug: value ?? ALL_INSTITUTES,
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

            <div className="flex justify-end">
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
