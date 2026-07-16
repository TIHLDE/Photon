import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { MarkdownView, RichEditor } from "@tihlde/ui/complex/markdown";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { CheckCircle2, XCircle } from "lucide-react";

import { createEventMutation } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { richRegistry } from "#/components/markdown/directives/presets";

export const Route = createFileRoute("/admin/arrangementer")({
    component: EventAdminPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

const INITIAL_DESCRIPTION = `# Arrangementsbeskrivelse

Beskriv arrangementet med **markdown**.

:::callout{type=warn title="Påmelding"}
Husk å sjekke kapasitet og påmeldingsfrist før du publiserer.
:::
`;

/** datetime-local value ("YYYY-MM-DDTHH:mm") -> ISO string, or null when empty */
function toIso(value: string): string | null {
    if (!value) return null;
    return new Date(value).toISOString();
}

function EventAdminPage() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState(INITIAL_DESCRIPTION);
    const [categorySlug, setCategorySlug] = useState("");
    const [organizerGroupSlug, setOrganizerGroupSlug] = useState("");
    const [location, setLocation] = useState("");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [registrationEnd, setRegistrationEnd] = useState("");
    const [capacity, setCapacity] = useState("");
    const [isPaidEvent, setIsPaidEvent] = useState(false);
    const [price, setPrice] = useState("");

    const createEvent = useMutation(createEventMutation);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const startIso = toIso(start);
        const endIso = toIso(end);
        const registrationEndIso = toIso(registrationEnd);
        if (!startIso || !endIso || !registrationEndIso) return;

        createEvent.mutate(
            {
                data: {
                    title,
                    description,
                    categorySlug,
                    organizerGroupSlug,
                    location,
                    imageUrl: null,
                    start: startIso,
                    end: endIso,
                    registrationStart: null,
                    registrationEnd: registrationEndIso,
                    cancellationDeadline: null,
                    capacity: capacity ? Number(capacity) : null,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
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
                    setDescription(INITIAL_DESCRIPTION);
                    setCategorySlug("");
                    setOrganizerGroupSlug("");
                    setLocation("");
                    setStart("");
                    setEnd("");
                    setRegistrationEnd("");
                    setCapacity("");
                    setIsPaidEvent(false);
                    setPrice("");
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nytt arrangement</h1>
                <p className="text-muted-foreground">
                    Beskrivelsen lagres som markdown og rendres med samme
                    direktiv-registret som redigeringen.
                </p>
            </div>

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
                                <Input
                                    id="event-location"
                                    type="text"
                                    required
                                    value={location}
                                    onChange={(event) =>
                                        setLocation(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="event-start">
                                    Starttidspunkt
                                </FieldLabel>
                                <Input
                                    id="event-start"
                                    type="datetime-local"
                                    required
                                    value={start}
                                    onChange={(event) =>
                                        setStart(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="event-end">
                                    Sluttidspunkt
                                </FieldLabel>
                                <Input
                                    id="event-end"
                                    type="datetime-local"
                                    required
                                    value={end}
                                    onChange={(event) =>
                                        setEnd(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="event-reg-end">
                                    Påmeldingsfrist
                                </FieldLabel>
                                <Input
                                    id="event-reg-end"
                                    type="datetime-local"
                                    required
                                    value={registrationEnd}
                                    onChange={(event) =>
                                        setRegistrationEnd(event.target.value)
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
                                    value={capacity}
                                    onChange={(event) =>
                                        setCapacity(event.target.value)
                                    }
                                />
                            </Field>
                            <Field className="flex-row items-center gap-3">
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
                        <CardTitle>Forhåndsvisning</CardTitle>
                        <CardDescription>
                            Slik blir beskrivelsen vist for medlemmer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MarkdownView
                            registry={richRegistry}
                            source={description}
                        />
                    </CardContent>
                </Card>

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
                        disabled={createEvent.isPending || !organizerGroupSlug}
                    >
                        Publiser
                    </Button>
                </div>
            </form>
        </div>
    );
}
