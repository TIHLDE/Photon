import { CatchBoundary, Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    ArrowRight,
    CheckCircle2,
    Megaphone,
    TriangleAlert,
} from "lucide-react";
import { Suspense, useMemo } from "react";

import { getJobsQuery } from "#/api/queries/jobs";
import { sendCompanyContactMutation } from "#/api/queries/company";
import { CompanyContactForm } from "#/components/company-contact-form";
import { CompanyOfferCard } from "#/components/company-offer-card";
import { HeroSectionBackground } from "#/components/hero-section";
import { JobCard } from "#/components/job-card";
import { SectionError } from "#/components/section-error";
import { StudyProgrammeCard } from "#/components/study-programme-card";
import {
    COMPANY_EVENT_TYPES,
    COMPANY_OFFERS,
    STUDY_PROGRAMMES_SHORT,
    upcomingSemesters,
} from "#/data/company";
import { formatClassRange, formatJobDeadline, formatJobType } from "#/lib/job";

const JOB_PREVIEW_COUNT = 4;

const EVENT_TYPE_OPTIONS = COMPANY_EVENT_TYPES.map((type) => ({
    value: type,
    label: type,
}));

export const Route = createFileRoute("/_app/bedrift/")({
    component: CompanyLandingPage,
    // Sida er i hovedsak fast innhold og et kontaktskjema som ikke henter
    // noe. Stillingene er den eneste biten som spør API-et, og de får hente
    // seg selv bak sin egen Suspense- og feilgrense — et nede endepunkt skal
    // ikke ta med seg kontaktskjemaet, som er grunnen til at sida finnes.
});

function CompanyLandingPage() {
    return (
        <div className="flex w-full flex-col items-center">
            <section className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden">
                <HeroSectionBackground />
                <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
                    <p className="text-muted-foreground">
                        Møt morgendagens IT-talenter!
                    </p>
                    <h1 className="text-4xl font-bold md:text-6xl">
                        Samarbeid med TIHLDE
                    </h1>
                    <p className="text-muted-foreground">
                        Vi tilbyr unike muligheter for bedrifter til å knytte
                        seg til en ny generasjon IT-eksperter. Utforsk våre
                        tilbud og bli en del av nettverket som inspirerer,
                        engasjerer og rekrutterer!
                    </p>
                    <Button
                        size="lg"
                        className="mt-4"
                        render={<Link to="/bedrift" hash="kontakt" />}
                    >
                        Meld interesse
                        <Megaphone />
                    </Button>
                </div>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
                {COMPANY_OFFERS.map((offer, index) => (
                    <CompanyOfferCard
                        key={offer.title}
                        title={offer.title}
                        description={offer.description}
                        imageUrl={offer.imageUrl}
                        imageFirst={index % 2 === 1}
                    />
                ))}
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-16">
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl">Stillingsannonser</h2>
                    <p className="text-muted-foreground">
                        Publiser relevante stillinger, internships eller
                        trainee-programmer direkte til våre medlemmer. Sikre deg
                        de beste kandidatene!
                    </p>
                </div>
                <CatchBoundary
                    getResetKey={() => "jobs"}
                    errorComponent={() => (
                        <SectionError message="Vi fikk ikke lastet stillingene." />
                    )}
                >
                    <Suspense fallback={<JobPreviewSkeleton />}>
                        <JobPreview />
                    </Suspense>
                </CatchBoundary>
            </section>

            <section className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-16">
                <h2 className="text-3xl">Studiene</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    {STUDY_PROGRAMMES_SHORT.map((programme) => (
                        <StudyProgrammeCard
                            key={programme.title}
                            title={programme.title}
                            description={programme.description}
                            action={
                                <Button
                                    variant="link"
                                    render={<Link to="/bedrift/studiene" />}
                                >
                                    Les mer
                                    <ArrowRight />
                                </Button>
                            }
                        />
                    ))}
                </div>
            </section>

            <section
                id="kontakt"
                className="container mx-auto flex w-full max-w-4xl scroll-mt-24 flex-col gap-8 px-4 py-16"
            >
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-muted-foreground">
                        Møt morgendagens IT-talenter!
                    </p>
                    <h2 className="text-3xl md:text-4xl">
                        Send oss en melding
                    </h2>
                    <p className="max-w-2xl text-muted-foreground">
                        Ta direkte kontakt med Næringsliv og kurs for å
                        diskutere hva som passer deres bedrift best. Vi hjelper
                        dere med å få ut informasjon om deres bedrift!
                    </p>
                </div>

                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                    <CompanyContactSection />
                </Suspense>
            </section>
        </div>
    );
}

function CompanyContactSection() {
    const mutation = useMutation(sendCompanyContactMutation);

    const semesterOptions = useMemo(
        () =>
            upcomingSemesters().map((semester) => ({
                value: semester,
                label: semester,
            })),
        [],
    );

    return (
        <div className="flex flex-col gap-8">
            {mutation.isSuccess && (
                <Alert>
                    <CheckCircle2 />
                    <AlertTitle>Henvendelsen er sendt</AlertTitle>
                    <AlertDescription>
                        Takk for interessen! Næringsliv og kurs tar kontakt på
                        e-postadressen du oppga.
                    </AlertDescription>
                </Alert>
            )}

            {mutation.isError && (
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>Klarte ikke å sende henvendelsen</AlertTitle>
                    <AlertDescription>
                        Prøv igjen om litt, eller send en e-post direkte til
                        naeringslivsminister@tihlde.org.
                    </AlertDescription>
                </Alert>
            )}

            <CompanyContactForm
                eventTypeOptions={EVENT_TYPE_OPTIONS}
                semesterOptions={semesterOptions}
                onSubmit={async (values, { reset }) => {
                    try {
                        await mutation.mutateAsync({ data: values });
                        reset();
                    } catch {
                        // Surfaced through `mutation.isError` above
                    }
                }}
            />
        </div>
    );
}

function JobPreview() {
    const { data } = useSuspenseQuery(getJobsQuery(0, {}, JOB_PREVIEW_COUNT));

    if (data.items.length === 0) {
        return (
            <p className="text-muted-foreground">
                Ingen aktive stillingsannonser akkurat nå.
            </p>
        );
    }

    return (
        <>
            <ul className="flex flex-col gap-4 sm:gap-1">
                {data.items.map((job) => (
                    <li key={job.id}>
                        <JobCard
                            slug={job.id}
                            title={job.title}
                            jobType={formatJobType(job.jobType)}
                            classLevels={formatClassRange(
                                job.classStart,
                                job.classEnd,
                            )}
                            location={job.location}
                            deadline={formatJobDeadline(
                                job.deadline,
                                job.isContinuouslyHiring,
                            )}
                            imageUrl={job.imageUrl || undefined}
                        />
                    </li>
                ))}
            </ul>
            <Button
                variant="link"
                className="self-end"
                render={<Link to="/annonser" />}
            >
                Se alle stillinger
                <ArrowRight />
            </Button>
        </>
    );
}

function JobPreviewSkeleton() {
    return (
        <div className="flex flex-col gap-4 sm:gap-1">
            {Array.from({ length: JOB_PREVIEW_COUNT }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
            ))}
        </div>
    );
}
