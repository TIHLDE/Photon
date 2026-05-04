import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";

type EventRow = { title: string; meta: string };

const KOMMENDE: EventRow[] = [
    { title: "Bedpres · Bekk", meta: "tor 24. apr · Realfagbygget R2" },
    { title: "Fagkveld: AI & produksjon", meta: "ons 30. apr · Digs" },
];

const HAR_VART: EventRow[] = [
    { title: "Generalforsamling vår 2026", meta: "man 7. apr · KJL2" },
    { title: "Nyttårsfest 2026", meta: "fre 10. jan · Gløshaugen" },
];

const APNER_SNART: EventRow[] = [
    { title: "Sommerfest 2026", meta: "åpner for påmelding om 5 dager" },
];

export const Route = createFileRoute("/_app/profil/$id/arrangementer")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div className="flex flex-col gap-6">
            <EventSection label="Kommende" events={KOMMENDE} />
            <Separator />
            <EventSection label="Har vært" events={HAR_VART} />
            <Separator />
            <EventSection
                label="Åpner snart for påmelding"
                events={APNER_SNART}
            />
        </div>
    );
}

function EventSection({
    label,
    events,
}: {
    label: string;
    events: EventRow[];
}) {
    return (
        <section className="flex flex-col gap-3">
            <h3>{label}</h3>
            <ul className="flex flex-col gap-3">
                {events.map((event) => (
                    <li key={event.title}>
                        <Card
                            size="sm"
                            className="flex-row items-center gap-3 px-3"
                        >
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span>{event.title}</span>
                                <span>{event.meta}</span>
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>
        </section>
    );
}
