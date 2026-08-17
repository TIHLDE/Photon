import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { authClientWithRedirect, authQueryOptions } from "#/api/auth";
import {
    createExpenseApplicationMutation,
    createHsCaseApplicationMutation,
    createSportsSupportApplicationMutation,
    createSupportApplicationMutation,
    getApplicationOptionsQuery,
    fetchApplicationPdfUrl,
    getMyApplicationsQuery,
    uploadApplicationAttachment,
} from "#/api/queries/applications";
import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import {
    ExpenseForm,
    type ExpenseFormValues,
} from "#/components/soknader/expense-form";
import {
    HsCaseForm,
    type HsCaseFormValues,
} from "#/components/soknader/hs-case-form";
import { MyApplications } from "#/components/soknader/my-applications";
import { SOKNAD_NAV_ITEMS, type SoknadNavKey } from "#/components/soknader/nav";
import { toIsoDate } from "#/components/soknader/shared";
import {
    SupportForm,
    type SupportFormValues,
} from "#/components/soknader/support-form";

const searchSchema = z.object({
    tab: z
        .enum(["utlegg", "stotte", "idrettslag", "hs-sak", "mine"])
        .default("utlegg")
        .catch("utlegg"),
});

export const Route = createFileRoute("/_app/soknader")({
    component: SoknaderPage,
    validateSearch: searchSchema,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getApplicationOptionsQuery()),
});

function SoknaderPage() {
    const { tab: active } = Route.useSearch();
    const navigate = Route.useNavigate();

    const { data: options } = useSuspenseQuery(getApplicationOptionsQuery());
    const { data: session } = useQuery(authQueryOptions);
    const { data: myApplications } = useQuery(getMyApplicationsQuery());

    const createExpense = useMutation(createExpenseApplicationMutation);
    const createSupport = useMutation(createSupportApplicationMutation);
    const createSportsSupport = useMutation(
        createSportsSupportApplicationMutation,
    );
    const createHsCase = useMutation(createHsCaseApplicationMutation);

    const [feedback, setFeedback] = useState<{
        kind: "success" | "error";
        message: string;
    } | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    /**
     * The forms are tall enough that the submit button sits well below this
     * banner. Without scrolling to it, a submitted — or rejected — søknad
     * reads as "nothing happened".
     */
    const feedbackRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!feedback) return;
        feedbackRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }, [feedback]);

    function setActive(tab: SoknadNavKey) {
        setFeedback(null);
        navigate({ search: (prev) => ({ ...prev, tab }) });
    }

    const defaultContact = {
        name: session?.user?.name ?? "",
        email: session?.user?.email ?? "",
    };

    /** Upload every attachment first; the API only accepts asset keys. */
    async function uploadAll(files: File[]): Promise<string[]> {
        const keys: string[] = [];
        for (const file of files) {
            keys.push(await uploadApplicationAttachment(file));
        }
        return keys;
    }

    function reportError(error: unknown) {
        setFeedback({
            kind: "error",
            message:
                error instanceof Error
                    ? error.message
                    : "Noe gikk galt. Prøv igjen.",
        });
    }

    function reportSuccess(message: string) {
        setFeedback({ kind: "success", message });
    }

    async function submitExpense(
        values: ExpenseFormValues,
        helpers: { reset: () => void },
    ) {
        try {
            const attachmentKeys = await uploadAll(values.receipts);
            await createExpense.mutateAsync({
                contactName: values.contactName,
                contactEmail: values.contactEmail,
                ccEmail: values.cc?.email,
                amountNok: values.amountNok,
                expenseDate: toIsoDate(values.date),
                groupSlug: values.group.slug,
                budgetType: values.budgetType as never,
                description: values.description,
                accountNumber: values.accountNumber,
                attachmentKeys,
            });
            helpers.reset();
            reportSuccess(
                "Utlegget er sendt inn. Du finner det igjen under «Mine søknader».",
            );
        } catch (error) {
            reportError(error);
        }
    }

    async function submitSupport(
        values: SupportFormValues,
        helpers: { reset: () => void },
        sports: boolean,
    ) {
        try {
            const attachmentKeys = await uploadAll(values.budgetImages);
            const payload = {
                contactName: values.contactName,
                contactEmail: values.contactEmail,
                groupSlug: values.group.slug,
                purpose: values.purpose,
                eventDescription: values.eventDescription,
                justification: values.justification,
                totalAmountNok: values.totalAmountNok,
                budgetLink: values.budgetLink || undefined,
                summary: values.summary || undefined,
                attachmentKeys,
            };

            if (sports) {
                await createSportsSupport.mutateAsync(payload);
            } else {
                await createSupport.mutateAsync(payload);
            }

            helpers.reset();
            reportSuccess(
                "Søknaden er sendt inn. Du finner den igjen under «Mine søknader».",
            );
        } catch (error) {
            reportError(error);
        }
    }

    async function submitHsCase(
        values: HsCaseFormValues,
        helpers: { reset: () => void },
    ) {
        try {
            const attachmentKeys = await uploadAll(values.attachments);
            await createHsCase.mutateAsync({
                contactName: values.contactName,
                contactEmail: values.contactEmail,
                caseName: values.caseName,
                caseType: values.caseType as never,
                background: values.background,
                assessment: values.assessment,
                recommendation: values.recommendation || undefined,
                attachmentKeys,
            });
            helpers.reset();
            reportSuccess(
                "Saken er meldt inn til Hovedstyret. Du finner den igjen under «Mine søknader».",
            );
        } catch (error) {
            reportError(error);
        }
    }

    /**
     * PDFs are private assets, so they are fetched with credentials and
     * handed to the browser as an object URL rather than linked directly.
     */
    async function downloadPdf(id: string) {
        setDownloadingId(id);
        try {
            const url = await fetchApplicationPdfUrl(id);
            window.open(url, "_blank", "noopener");
            // The tab has the blob by the time the task queue drains.
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (error) {
            reportError(error);
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <DetailLayout
            header={
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl">Søknader</h1>
                    <p className="text-muted-foreground">
                        Send inn utlegg, søk om støtte, og meld inn saker til
                        Hovedstyret.
                    </p>
                </div>
            }
        >
            <DetailLayoutNav
                sections={[SOKNAD_NAV_ITEMS]}
                active={active}
                onSelect={setActive}
            />

            <DetailLayoutContent>
                {feedback ? (
                    <Alert ref={feedbackRef}>
                        {feedback.kind === "success" ? (
                            <CheckCircle2 />
                        ) : (
                            <TriangleAlert />
                        )}
                        <AlertTitle>
                            {feedback.kind === "success"
                                ? "Sendt inn"
                                : "Kunne ikke sende inn"}
                        </AlertTitle>
                        <AlertDescription>{feedback.message}</AlertDescription>
                    </Alert>
                ) : null}

                {active === "utlegg" ? (
                    <ExpenseForm
                        options={options}
                        defaultContact={defaultContact}
                        onSubmit={submitExpense}
                    />
                ) : null}

                {active === "stotte" ? (
                    <SupportForm
                        variant="general"
                        options={options}
                        defaultContact={defaultContact}
                        onSubmit={(values, helpers) =>
                            submitSupport(values, helpers, false)
                        }
                    />
                ) : null}

                {active === "idrettslag" ? (
                    <SupportForm
                        variant="sports"
                        options={options}
                        defaultContact={defaultContact}
                        onSubmit={(values, helpers) =>
                            submitSupport(values, helpers, true)
                        }
                    />
                ) : null}

                {active === "hs-sak" ? (
                    <HsCaseForm
                        options={options}
                        defaultContact={defaultContact}
                        onSubmit={submitHsCase}
                    />
                ) : null}

                {active === "mine" ? (
                    <MyApplications
                        applications={myApplications ?? []}
                        downloadingId={downloadingId}
                        onDownloadPdf={downloadPdf}
                    />
                ) : null}
            </DetailLayoutContent>
        </DetailLayout>
    );
}
