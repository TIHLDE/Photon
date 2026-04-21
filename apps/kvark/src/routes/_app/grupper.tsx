import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

import {
    GroupSummaryCard,
    type GroupSummaryCardProps,
} from "#/components/group-summary-card";

export const Route = createFileRoute("/_app/grupper")({
    component: GroupsPage,
});

type GroupSection = {
    title: string;
    groups: GroupSummaryCardProps[];
};

const SECTIONS: GroupSection[] = [
    {
        title: "Hovedorgan",
        groups: [
            {
                name: "Forvaltningsgruppen",
                leader: "Sigurd Evensen",
                email: "forvalt@tihlde.org",
            },
            {
                name: "Hovedstyret",
                leader: "Mads Wasserfall Lillelien",
                email: "hs@tihlde.org",
            },
        ],
    },
    {
        title: "Undergrupper",
        groups: [
            {
                name: "Beta",
                leader: "Ola Tjerbo Berg",
                email: "beta@tihlde.org",
            },
            {
                name: "Index",
                leader: "Mathias Strøm",
                email: "hovedingeniorsteder@tihlde.org",
            },
            {
                name: "Kiosk og Kontor",
                leader: "Eivind Hansrønnes Fagerhaug",
                email: "kioskogkontor@tihlde.org",
            },
            {
                name: "Næringsliv og Kurs",
                leader: "Jørgen Øyen Digre",
                email: "naeringsliv@tihlde.org",
            },
            {
                name: "Promo",
                leader: "Natalie Coates Tvete",
                email: "promo@tihlde.org",
            },
            {
                name: "Sosialen",
                leader: "John Eliot Holm Finseth",
                email: "sosialminister@tihlde.org",
            },
        ],
    },
    {
        title: "Komitéer",
        groups: [
            {
                name: "Drift",
                leader: "Sofie Sirevåg Tysdal",
                email: "driftminister@tihlde.org",
            },
            {
                name: "FadderKom",
                leader: "Preben Bugge Angelsnes",
                email: "fadder@tihlde.org",
            },
            {
                name: "IdKom",
                leader: "Nhiri Halvorsen",
                email: "idkom@tihlde.org",
            },
            {
                name: "JenteKom",
                leader: "Ole Irene Wang Berntsen",
                email: "jentekom@tihlde.org",
            },
            {
                name: "JubKom",
                leader: "Nihril Mausvi",
                email: "jubkom@tihlde.org",
            },
            {
                name: "Native",
                leader: "Mads Nylund",
                email: "nadpro@gmail.com",
            },
            {
                name: "ØkoKom",
                leader: "Marcus Koranes",
                email: "okominister@tihlde.org",
            },
            {
                name: "Redaksjonen",
                leader: "Cecilie Silva Børve",
                email: "redaktor@tihlde.org",
            },
            {
                name: "Semikolon",
                leader: "Cecilie Vu",
                email: "semikolon@tihlde.org",
            },
        ],
    },
];

function GroupsPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-4 px-4 py-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Gruppeoversikt</CardTitle>
                    <div className="col-start-2 row-start-1 self-start justify-self-end">
                        <Button size="sm">Interessegrupper</Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {SECTIONS.map((section) => (
                        <section
                            key={section.title}
                            className="flex flex-col gap-2"
                        >
                            <h2 className="text-lg">{section.title}</h2>
                            <div className="grid gap-2 md:grid-cols-2">
                                {section.groups.map((group) => (
                                    <GroupSummaryCard
                                        key={group.name}
                                        {...group}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
