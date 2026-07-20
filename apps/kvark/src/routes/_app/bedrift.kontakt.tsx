import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import { sendCompanyContactMutation } from "#/api/queries/company";
import { CompanyContactForm } from "#/components/company-contact-form";
import { COMPANY_EVENT_TYPES, upcomingSemesters } from "#/data/company";

export const Route = createFileRoute("/_app/bedrift/kontakt")({
    component: CompanyContactPage,
});

const EVENT_TYPE_OPTIONS = COMPANY_EVENT_TYPES.map((type) => ({
    value: type,
    label: type,
}));

function CompanyContactPage() {
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
        <div className="container mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16">
            <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-muted-foreground">
                    Møt morgendagens IT-talenter!
                </p>
                <h1 className="text-4xl md:text-5xl">Send oss en melding</h1>
                <p className="max-w-2xl text-muted-foreground">
                    Ta direkte kontakt med Næringsliv og kurs for å diskutere
                    hva som passer deres bedrift best. Vi hjelper dere med å få
                    ut informasjon om deres bedrift!
                </p>
            </div>

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
