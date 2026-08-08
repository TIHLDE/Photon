import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { authClientWithRedirect, authQueryOptions } from "#/api/auth";
import { getGroupFormsQuery, getGroupsQuery } from "#/api/queries/groups";
import {
    type AdmissionGroup,
    type AdmissionStatus,
    GroupAdmissionCard,
    GroupAdmissionLinkCard,
} from "#/components/group-admission-card";
import { HeroSectionBackground } from "#/components/hero-section";
import { ADMISSION_INFOS } from "#/data/admissions";

export const Route = createFileRoute("/_app/opptak")({
    component: AdmissionsPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

type ApiGroup = {
    name: string;
    slug: string;
    type: string;
    contactEmail: string | null;
    logoUrl: string | null;
};

/**
 * Grupper man ikke søker seg inn i, og som derfor ikke hører hjemme på
 * opptakssiden. Hovedstyret velges på generalforsamlingen.
 */
const NOT_OPEN_FOR_ADMISSION = new Set(["hs"]);

function toAdmissionGroups(groups: ApiGroup[], type: string): AdmissionGroup[] {
    return groups
        .filter(
            (group) =>
                group.type === type && !NOT_OPEN_FOR_ADMISSION.has(group.slug),
        )
        .map((group) => ({
            name: group.name,
            slug: group.slug,
            email: group.contactEmail ?? undefined,
            logoUrl: group.logoUrl ?? undefined,
        }));
}

function AdmissionsPage() {
    const { data: apiGroups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: session } = useQuery(authQueryOptions);
    const isAuthenticated = Boolean(session);

    const { boards, subgroups, committees, interestGroups } = useMemo(() => {
        const groups = apiGroups as ApiGroup[];
        return {
            boards: toAdmissionGroups(groups, "BOARD"),
            subgroups: toAdmissionGroups(groups, "SUBGROUP"),
            committees: toAdmissionGroups(groups, "COMMITTEE"),
            interestGroups: toAdmissionGroups(groups, "INTERESTGROUP"),
        };
    }, [apiGroups]);

    return (
        <div className="flex w-full flex-col items-center">
            <section className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden">
                <HeroSectionBackground />
                <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
                    <p className="text-muted-foreground">
                        Bli med på å skape studentmiljøet
                    </p>
                    <h1 className="text-4xl font-bold md:text-6xl">
                        Søk verv!
                    </h1>
                    <p className="text-muted-foreground">
                        Her finner du en oversikt over alle vervene i TIHLDE.
                        Søk på vervene du er interessert i, og bli med på å
                        skape et bedre studentmiljø!
                    </p>
                </div>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
                <div className="flex max-w-xl flex-col gap-2">
                    <h2 className="text-3xl">Hva er verv?</h2>
                    <p className="text-muted-foreground">
                        Et verv er en oppgave eller et ansvar som du får tildelt
                        i TIHLDE. Et verv gir deg muligheten til å være med på å
                        skape et bedre studentmiljø, og du lærer mye nyttig
                        underveis som du vil ta med deg resten av livet.
                    </p>
                </div>
                <div className="grid gap-8 lg:grid-cols-3">
                    {ADMISSION_INFOS.map((info) => (
                        <div key={info.title} className="flex flex-col gap-2">
                            <h3 className="font-semibold">{info.title}</h3>
                            <p className="text-muted-foreground">
                                {info.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
                <div className="flex flex-col gap-2 text-center">
                    <h2 className="text-3xl">
                        Det er mange verv å velge mellom!
                    </h2>
                    <p className="mx-auto max-w-lg text-muted-foreground">
                        Du vil bli kalt inn til intervju etter søknadsfristen,
                        for alle verv du har søkt på.
                    </p>
                </div>

                <AdmissionSection
                    title="Hovedorgan"
                    groups={boards}
                    isAuthenticated={isAuthenticated}
                />
                <AdmissionSection
                    title="Undergrupper"
                    groups={subgroups}
                    isAuthenticated={isAuthenticated}
                />
                <AdmissionSection
                    title="Komitéer"
                    groups={committees}
                    isAuthenticated={isAuthenticated}
                />
            </section>

            {interestGroups.length > 0 ? (
                <section className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
                    <div className="flex flex-col gap-2 text-center">
                        <h2 className="text-3xl">Interessegrupper</h2>
                        <p className="mx-auto max-w-xl text-muted-foreground">
                            TIHLDE har flere interessegrupper som du kan bli med
                            i. Her kan du drive med det du er interessert i,
                            eller lære noe nytt. Interessegruppene er åpne for
                            alle, og du kan være med i så mange du vil.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {interestGroups.map((group) => (
                            <GroupAdmissionLinkCard
                                key={group.slug}
                                group={group}
                            />
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}

function AdmissionSection({
    title,
    groups,
    isAuthenticated,
}: {
    title: string;
    groups: AdmissionGroup[];
    isAuthenticated: boolean;
}) {
    if (groups.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                    <AdmissionCardContainer
                        key={group.slug}
                        group={group}
                        isAuthenticated={isAuthenticated}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Owns the per-group form query. Forms are only readable when logged in, and
 * only worth fetching once the card has been opened.
 */
function AdmissionCardContainer({
    group,
    isAuthenticated,
}: {
    group: AdmissionGroup;
    isAuthenticated: boolean;
}) {
    const [open, setOpen] = useState(false);

    const { data: forms, isLoading } = useQuery({
        ...getGroupFormsQuery(group.slug),
        enabled: open && isAuthenticated,
    });

    const admissionForm = useMemo(
        () => forms?.find((f) => f.title.toLowerCase().includes("opptak")),
        [forms],
    );

    const status = useMemo<AdmissionStatus>(() => {
        if (!isAuthenticated) return "unauthenticated";
        if (isLoading || !forms) return "loading";

        if (!admissionForm) return "missing";
        if (!admissionForm.is_open_for_submissions) return "closed";
        if (
            !admissionForm.can_submit_multiple &&
            admissionForm.viewer_has_answered
        ) {
            return "answered";
        }
        return "open";
    }, [admissionForm, forms, isAuthenticated, isLoading]);

    return (
        <GroupAdmissionCard
            group={group}
            open={open}
            onOpenChange={setOpen}
            status={status}
            formId={admissionForm?.id}
        />
    );
}
