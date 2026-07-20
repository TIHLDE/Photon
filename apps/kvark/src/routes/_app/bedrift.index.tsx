import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { ArrowRight, Megaphone } from "lucide-react";
import { Suspense } from "react";

import { getJobsQuery } from "#/api/queries/jobs";
import { CompanyOfferCard } from "#/components/company-offer-card";
import { HeroSectionBackground } from "#/components/hero-section";
import { JobCard } from "#/components/job-card";
import { StudyProgrammeCard } from "#/components/study-programme-card";
import { COMPANY_OFFERS, STUDY_PROGRAMMES_SHORT } from "#/data/company";
import { formatClassRange, formatJobDeadline, formatJobType } from "#/lib/job";

const JOB_PREVIEW_COUNT = 4;

export const Route = createFileRoute("/_app/bedrift/")({
    component: CompanyLandingPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(
            getJobsQuery(0, {}, JOB_PREVIEW_COUNT),
        ),
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
                    <h1 className="text-4xl md:text-6xl">
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
                        nativeButton={false}
                        render={<Link to="/bedrift/kontakt" />}
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
                <Suspense fallback={<JobPreviewSkeleton />}>
                    <JobPreview />
                </Suspense>
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
                                    nativeButton={false}
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

            <section className="container mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
                <h2 className="text-3xl md:text-4xl">Ta kontakt med oss</h2>
                <p className="max-w-xl text-muted-foreground">
                    Bedrifter kan ta kontakt med oss for å få mer informasjon om
                    hva vi tilbyr og hvordan vi kan hjelpe dem med å nå ut til
                    våre medlemmer.
                </p>
                <Button
                    size="lg"
                    className="mt-2"
                    nativeButton={false}
                    render={<Link to="/bedrift/kontakt" />}
                >
                    Ta kontakt
                </Button>
            </section>
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
                nativeButton={false}
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
