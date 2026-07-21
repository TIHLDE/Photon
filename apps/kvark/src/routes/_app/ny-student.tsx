import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { ArrowRight, AtSign, Facebook, Instagram, Users2 } from "lucide-react";
import { Suspense, useMemo } from "react";

import { authQueryOptions } from "#/api/auth";
import { getGroupsQuery } from "#/api/queries/groups";
import { getToddelIssuesQuery } from "#/api/queries/toddel";
import {
    type AdmissionGroup,
    GroupAdmissionLinkCard,
} from "#/components/group-admission-card";
import { HeroSectionBackground } from "#/components/hero-section";

export const Route = createFileRoute("/_app/ny-student")({
    component: NewStudentPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

const FADDERUKA_URL = "https://fadderuka.tihlde.org";
const NEW_STUDENT_WIKI_URL = "https://wiki.tihlde.org/ny-student";

const CONTACTS = [
    { icon: AtSign, label: "hs@tihlde.org", href: "mailto:hs@tihlde.org" },
    {
        icon: AtSign,
        label: "fadderkom@tihlde.org",
        href: "mailto:fadderkom@tihlde.org",
    },
    {
        icon: Instagram,
        label: "@tihlde",
        href: "https://www.instagram.com/tihlde/",
    },
    {
        icon: Facebook,
        label: "TIHLDE",
        href: "https://www.facebook.com/tihlde/",
    },
] as const;

type ApiGroup = {
    name: string;
    slug: string;
    type: string;
    contactEmail: string | null;
    imageUrl: string | null;
};

function toGroups(groups: ApiGroup[], type: string): AdmissionGroup[] {
    return groups
        .filter((group) => group.type === type)
        .map((group) => ({
            name: group.name,
            slug: group.slug,
            email: group.contactEmail ?? undefined,
            logoUrl: group.imageUrl ?? undefined,
        }));
}

function NewStudentPage() {
    const { data: session } = useQuery(authQueryOptions);
    const isAuthenticated = Boolean(session);

    return (
        <div className="flex w-full flex-col items-center">
            <section className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden">
                <HeroSectionBackground />
                <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
                    <h1 className="text-4xl md:text-6xl">
                        Velkommen til linjeforeningen TIHLDE!
                    </h1>
                    <p className="text-muted-foreground">
                        Her finner du nyttig info om hvordan linjeforeningen og
                        fadderuka fungerer. Er du ny student kan du melde deg på
                        fadderuka under. Du burde også lage deg en bruker om du
                        ikke har gjort det allerede.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            nativeButton={false}
                            render={
                                <a
                                    href={FADDERUKA_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            }
                        >
                            <Users2 />
                            Meld meg på fadderuka
                        </Button>
                        <Button
                            variant="outline"
                            nativeButton={false}
                            render={
                                isAuthenticated ? (
                                    <Link to="/opptak" />
                                ) : (
                                    <Link to="/register" />
                                )
                            }
                        >
                            {isAuthenticated ? "Søk verv" : "Opprett bruker"}
                            <ArrowRight />
                        </Button>
                    </div>
                </div>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-16">
                <p className="text-muted-foreground">
                    Ditt første møte med TIHLDE
                </p>
                <h2 className="text-3xl md:text-5xl">Fadderuka</h2>
                <p className="max-w-2xl text-muted-foreground">
                    Fadderuka er en gyllen mulighet til å bli kjent med
                    medstudenter og med linjeforeningen. Fadderuka varer fra uka
                    før skolestart til en uke inn i semesteret. Meld deg på for
                    å få plass!
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        nativeButton={false}
                        render={
                            <a
                                href={FADDERUKA_URL}
                                target="_blank"
                                rel="noreferrer"
                            />
                        }
                    >
                        Meld meg på!
                    </Button>
                    <Button
                        variant="outline"
                        nativeButton={false}
                        render={<Link to="/arrangementer" />}
                    >
                        Hva skjer i fadderuka?
                    </Button>
                    <Button
                        variant="ghost"
                        nativeButton={false}
                        render={
                            <a
                                href={NEW_STUDENT_WIKI_URL}
                                target="_blank"
                                rel="noreferrer"
                            />
                        }
                    >
                        Les mer
                        <ArrowRight />
                    </Button>
                </div>
            </section>

            <section className="container mx-auto flex max-w-4xl flex-col gap-2 px-4 py-16">
                <p className="text-muted-foreground">Hva er egentlig TIHLDE?</p>
                <p className="text-xl md:text-3xl">
                    «TIHLDE (Trondheim IngeniørHøgskoles Linjeforening for
                    Dannede EDBere) er linjeforeningen for bachelorstudiene
                    Dataingeniør, Digital infrastruktur og cybersikkerhet,
                    Digital forretningsutvikling, samt masterstudiet Digital
                    transformasjon og det nettbaserte studiet
                    Informasjonsbehandling.»
                </p>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
                <div className="flex flex-col gap-2 text-center">
                    <h2 className="text-2xl md:text-4xl">
                        TIHLDE er drevet av frivillige studenter — bli kjent med
                        de forskjellige vervene
                    </h2>
                    <p className="mx-auto max-w-lg text-muted-foreground">
                        Opptaksrunder skjer rett etter fadderuka. Du blir kalt
                        inn på intervju ved å sende søknad.
                    </p>
                </div>
                <Suspense fallback={<GroupSectionsSkeleton />}>
                    <GroupSections />
                </Suspense>
            </section>

            <Suspense fallback={null}>
                <LatestToddelSection />
            </Suspense>

            <section className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
                <h2 className="text-center text-2xl md:text-4xl">
                    Har du flere spørsmål? Ta kontakt her
                </h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {CONTACTS.map((contact) => (
                        <a
                            key={contact.label}
                            href={contact.href}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Card size="sm" className="h-full">
                                <CardContent className="flex flex-col items-center gap-4 py-8">
                                    <contact.icon className="size-10" />
                                    <p className="text-muted-foreground">
                                        {contact.label}
                                    </p>
                                </CardContent>
                            </Card>
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );
}

function GroupSectionsSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
            ))}
        </div>
    );
}

function GroupSections() {
    const { data: apiGroups } = useSuspenseQuery(getGroupsQuery(0));

    const sections = useMemo(() => {
        const groups = apiGroups as ApiGroup[];
        return [
            { title: "Hovedorgan", groups: toGroups(groups, "BOARD") },
            { title: "Undergrupper", groups: toGroups(groups, "SUBGROUP") },
            { title: "Komitéer", groups: toGroups(groups, "COMMITTEE") },
            {
                title: "Interessegrupper",
                groups: toGroups(groups, "INTERESTGROUP"),
            },
        ].filter((section) => section.groups.length > 0);
    }, [apiGroups]);

    return (
        <div className="flex flex-col gap-10">
            {sections.map((section) => (
                <div key={section.title} className="flex flex-col gap-3">
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {section.groups.map((group) => (
                            <GroupAdmissionLinkCard
                                key={group.slug}
                                group={group}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * The whole section is skipped when the archive has no cover to show — a
 * heading with nothing under it reads as a broken page.
 */
function LatestToddelSection() {
    const { data: issues } = useSuspenseQuery(getToddelIssuesQuery());
    const latest = issues[0];

    if (!latest?.imageUrl) return null;

    return (
        <section className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
            <h2 className="text-center text-2xl md:text-4xl">
                TIHLDEs avis heter TÖDDEL — les siste utgave her
            </h2>
            <Link to="/toddel" className="mx-auto w-full max-w-md">
                <img
                    src={latest.imageUrl}
                    alt={latest.title}
                    className="w-full"
                    loading="lazy"
                />
            </Link>
        </section>
    );
}
