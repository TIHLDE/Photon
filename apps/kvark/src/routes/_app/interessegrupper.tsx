import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    ArrowRightIcon,
    HandCoinsIcon,
    InfoIcon,
    type LucideIcon,
    PlusIcon,
} from "lucide-react";
import { useMemo } from "react";

import { getGroupsQuery } from "#/api/queries/groups";
import { GroupListView } from "#/components/group-list-view";
import { PageHeader } from "#/components/page-header";
import type { GroupTreeInput, SimpleSection } from "#/lib/build-group-tree";

export const Route = createFileRoute("/_app/interessegrupper")({
    component: InterestGroupsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

type InfoLink = {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
};

const INFO_LINKS: InfoLink[] = [
    {
        title: "Hva er en interessegruppe?",
        description:
            "Lær mer om hva det innebærer å ha en interessegruppe på vår wiki.",
        href: "https://wiki.tihlde.org/struktur#interessegrupper",
        icon: InfoIcon,
    },
    {
        title: "Opprett interessegruppe",
        description:
            "Har du en god idé for en interessegruppe? Fyll ut vårt søknadsskjema for å opprette en ny gruppe.",
        href: "https://drive.google.com/file/d/1Y4VDE8yUiIwpg5Vow6SBuO6QxnrDzagl/edit",
        icon: PlusIcon,
    },
    {
        title: "Søk om pengestøtte",
        description:
            "Interessegrupper har muligheten til å søke om finansiell støtte.",
        href: "https://wiki.tihlde.org/soknader-okonomisk#stotte-fra-hs",
        icon: HandCoinsIcon,
    },
];

type ApiGroup = {
    name: string;
    slug: string;
    type: string;
    subtype: string | null;
    contactEmail: string | null;
    logoUrl: string | null;
};

function sectionOf(
    id: string,
    label: string,
    groups: ApiGroup[],
): SimpleSection {
    return {
        id,
        label,
        cols: 3,
        items: groups.map((g) => ({
            name: g.name,
            slug: g.slug,
            email: g.contactEmail ?? undefined,
            logoUrl: g.logoUrl ?? undefined,
        })),
    };
}

function interestGroupTree(groups: ApiGroup[]): GroupTreeInput {
    const interest = groups.filter((g) => g.type === "INTERESTGROUP");
    return {
        main: [
            sectionOf(
                "grupper",
                "Grupper",
                interest.filter((g) => g.subtype !== "IDRETTSGRUPPE"),
            ),
            sectionOf(
                "idrettsgrupper",
                "Idrettsgrupper",
                interest.filter((g) => g.subtype === "IDRETTSGRUPPE"),
            ),
        ],
        branches: [],
    };
}

function InfoLinkCard({ title, description, href, icon: Icon }: InfoLink) {
    return (
        <a
            className="group block h-full"
            href={href}
            rel="noreferrer"
            target="_blank"
        >
            <Card className="h-full transition-colors group-hover:bg-muted">
                <CardContent className="flex h-full gap-3">
                    <Icon className="size-5 shrink-0" />
                    <div className="flex flex-1 flex-col gap-2">
                        <h2 className="leading-none font-medium">{title}</h2>
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                        <span className="mt-auto flex items-center justify-end gap-2 text-sm">
                            Les mer
                            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    </div>
                </CardContent>
            </Card>
        </a>
    );
}

function InterestGroupsPage() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const tree = useMemo(
        () => interestGroupTree(groups as ApiGroup[]),
        [groups],
    );

    return (
        <div className="container mx-auto flex w-full flex-col gap-8 px-4 py-8">
            <PageHeader
                title="Interessegrupper"
                description="Her finner du en oversikt over alle interessegruppene i TIHLDE. Trykk på en gruppe for å se mer informasjon om den."
            />

            <div className="grid items-stretch gap-4 md:grid-cols-3">
                {INFO_LINKS.map((link) => (
                    <InfoLinkCard key={link.href} {...link} />
                ))}
            </div>

            <GroupListView tree={tree} />
        </div>
    );
}
