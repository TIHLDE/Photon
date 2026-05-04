import { createFileRoute } from "@tanstack/react-router";

import { EventRegistrationCard } from "#/components/event-registration-card";
import type { EventRegistrationState } from "#/mock/events";

export const Route = createFileRoute("/_app/arrangementer-states")({
    component: ArrangementerStatesPage,
});

const STATES: { state: EventRegistrationState; title: string }[] = [
    { state: "not-open", title: "Ikke åpnet" },
    { state: "open", title: "Åpen" },
    { state: "joined", title: "Påmeldt" },
    { state: "awaiting-payment", title: "Venter på betaling" },
    { state: "on-waitlist", title: "På venteliste" },
    { state: "full", title: "Fullt" },
    { state: "closed", title: "Stengt" },
    { state: "not-eligible", title: "Kan ikke melde seg på" },
];

function ArrangementerStatesPage() {
    return (
        <article className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl">Påmelding states</h1>
                <p className="text-muted-foreground">
                    Forhåndsvisning av Påmelding-kortet i ulike tilstander.
                </p>
            </header>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {STATES.map((entry) => (
                    <div key={entry.state} className="flex flex-col gap-2">
                        <span className="text-sm text-muted-foreground">
                            {entry.title}
                        </span>
                        <EventRegistrationCard {...buildProps(entry.state)} />
                    </div>
                ))}
            </div>
        </article>
    );
}

function buildProps(state: EventRegistrationState) {
    const base = {
        registrationOpensAt: "Tor 23. apr 2026, 12:00",
        registrationClosesAt: "Tor 30. apr 2026, 18:00",
        capacity: 80 as number | null,
        registeredCount: 56,
        waitlistCount: 0,
        isAdmin: false,
        price: "Gratis",
    };

    switch (state) {
        case "not-open":
            return {
                ...base,
                registrationState: state,
                registrationOpensInLabel: "1 time",
                registeredCount: 0,
            };
        case "joined":
            return {
                ...base,
                registrationState: state,
                unregisterDeadline: "Ons 29. apr 2026, 12:00",
                price: "kr 250",
            };
        case "awaiting-payment":
            return {
                ...base,
                registrationState: state,
                unregisterDeadline: "Ons 29. apr 2026, 12:00",
                paymentDeadline: "Søn 26. apr 2026, 23:59",
                price: "kr 250",
            };
        case "on-waitlist":
            return {
                ...base,
                registrationState: state,
                registeredCount: 80,
                waitlistCount: 12,
                waitlistPosition: 3,
            };
        case "full":
            return {
                ...base,
                registrationState: state,
                registeredCount: 80,
                waitlistCount: 4,
            };
        case "closed":
            return {
                ...base,
                registrationState: state,
                registeredCount: 67,
            };
        case "not-eligible":
            return {
                ...base,
                registrationState: state,
                notEligibleReason:
                    "Kun for 3.–5. klasse Dataingeniør og Digital Forretningsutvikling.",
            };
        case "open":
        default:
            return {
                ...base,
                registrationState: state,
            };
    }
}
