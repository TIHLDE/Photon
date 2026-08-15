import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Separator } from "@tihlde/ui/ui/separator";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type {
    ApplicationDetail,
    ApplicationStatus,
} from "#/api/queries/applications";
import { formatIsoDate, formatNok } from "./format";
import { ApplicationStatusBadge } from "./status-badge";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
    { value: "new", label: "Ny" },
    { value: "in_progress", label: "Under behandling" },
    { value: "approved", label: "Godkjent" },
    { value: "rejected", label: "Avslått" },
];

type Field = { label: string; value: string };

/** Flatten the type-specific detail into label/value rows for display. */
function detailFields(application: ApplicationDetail): Field[] {
    if (application.expense) {
        const expense = application.expense;
        return [
            { label: "Gruppe", value: expense.group.name },
            { label: "Beløp", value: formatNok(expense.amountNok) },
            { label: "Dato", value: formatIsoDate(expense.expenseDate) },
            { label: "Budsjetttype", value: expense.budgetTypeLabel },
            { label: "Kontonummer", value: expense.accountNumber },
            ...(expense.ccEmail
                ? [{ label: "Kopi til", value: expense.ccEmail }]
                : []),
            { label: "Hva utlegget er for", value: expense.description },
        ];
    }

    if (application.support) {
        const support = application.support;
        return [
            { label: "Gruppe", value: support.group.name },
            {
                label: "Søknadsbeløp",
                value: formatNok(support.totalAmountNok),
            },
            { label: "Formål", value: support.purpose },
            { label: "Beskrivelse", value: support.eventDescription },
            { label: "Begrunnelse", value: support.justification },
            ...(support.budgetLink
                ? [{ label: "Budsjettlenke", value: support.budgetLink }]
                : []),
            ...(support.summary
                ? [{ label: "Oppsummering", value: support.summary }]
                : []),
        ];
    }

    if (application.hsCase) {
        const hsCase = application.hsCase;
        return [
            { label: "Sak", value: hsCase.caseName },
            { label: "Type", value: hsCase.caseTypeLabel },
            { label: "Bakgrunn", value: hsCase.background },
            { label: "Vurdering", value: hsCase.assessment },
            ...(hsCase.recommendation
                ? [{ label: "Innstilling", value: hsCase.recommendation }]
                : []),
        ];
    }

    if (application.companyContact) {
        const contact = application.companyContact;
        return [
            { label: "Bedrift", value: contact.company },
            { label: "Arrangementer", value: contact.eventTypes.join(", ") },
            { label: "Semester", value: contact.semesters.join(", ") },
            ...(contact.comment
                ? [{ label: "Kommentar", value: contact.comment }]
                : []),
        ];
    }

    return [];
}

type AdminDetailDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    application: ApplicationDetail | undefined;
    isLoading: boolean;
    /** Object URLs for the attachments, keyed by asset key. */
    attachmentUrls: Record<string, string>;
    isSaving: boolean;
    /**
     * Whether the viewer may actually decide the søknad. Holders of the
     * `*:view` permission can open it but not change its status, so the whole
     * decision block is hidden from them rather than left there to fail.
     */
    canManage: boolean;
    onSave: (values: {
        status: ApplicationStatus;
        internalComment: string;
        messageToSubmitter: string;
    }) => void;
    onDownloadPdf: () => void;
};

export function AdminDetailDialog({
    open,
    onOpenChange,
    application,
    isLoading,
    attachmentUrls,
    isSaving,
    canManage,
    onSave,
    onDownloadPdf,
}: AdminDetailDialogProps) {
    const [status, setStatus] = useState<ApplicationStatus>("new");
    const [internalComment, setInternalComment] = useState("");
    const [messageToSubmitter, setMessageToSubmitter] = useState("");

    // Re-seed the editable fields whenever a different søknad is opened.
    useEffect(() => {
        if (!application) return;
        setStatus(application.status);
        setInternalComment(application.internalComment ?? "");
        setMessageToSubmitter("");
    }, [application]);

    const isDecision = status === "approved" || status === "rejected";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                {isLoading || !application ? (
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{application.title}</DialogTitle>
                            <DialogDescription>
                                {application.typeLabel} · sendt inn av{" "}
                                {application.contactName} (
                                {application.contactEmail})
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBody>
                            <div className="flex flex-wrap items-center gap-2">
                                <ApplicationStatusBadge
                                    status={application.status}
                                    label={application.statusLabel}
                                />
                                <span className="text-sm text-muted-foreground">
                                    {new Date(
                                        application.createdAt,
                                    ).toLocaleString("nb-NO")}
                                </span>
                                {application.hasPdf && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="ml-auto"
                                        onClick={onDownloadPdf}
                                    >
                                        <Download className="size-4" />
                                        Last ned PDF
                                    </Button>
                                )}
                            </div>

                            <Separator />

                            <dl className="grid gap-3">
                                {detailFields(application).map((field) => (
                                    <div
                                        key={field.label}
                                        className="flex flex-col gap-1"
                                    >
                                        <dt className="text-sm text-muted-foreground">
                                            {field.label}
                                        </dt>
                                        <dd className="whitespace-pre-wrap">
                                            {field.value}
                                        </dd>
                                    </div>
                                ))}
                                <div className="flex flex-col gap-1">
                                    <dt className="text-sm text-muted-foreground">
                                        Signatur
                                    </dt>
                                    <dd>{application.signature}</dd>
                                </div>
                            </dl>

                            {application.attachments.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="flex flex-col gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            Vedlegg
                                        </span>
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                            {application.attachments.map(
                                                (attachment) => {
                                                    const url =
                                                        attachmentUrls[
                                                            attachment.assetKey
                                                        ];
                                                    return url ? (
                                                        <a
                                                            key={attachment.id}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <img
                                                                src={url}
                                                                alt="Vedlegg"
                                                                className="h-32 w-full rounded-md object-cover"
                                                            />
                                                        </a>
                                                    ) : (
                                                        <Skeleton
                                                            key={attachment.id}
                                                            className="h-32 w-full"
                                                        />
                                                    );
                                                },
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {canManage ? (
                                <>
                                    <Separator />

                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-2">
                                            <Label htmlFor="application-status">
                                                Status
                                            </Label>
                                            <Select
                                                value={status}
                                                onValueChange={(value) =>
                                                    setStatus(
                                                        value as ApplicationStatus,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="application-status"
                                                    className="w-full"
                                                >
                                                    <SelectValue>
                                                        {(value) =>
                                                            STATUS_OPTIONS.find(
                                                                (option) =>
                                                                    option.value ===
                                                                    value,
                                                            )?.label ?? null
                                                        }
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUS_OPTIONS.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label htmlFor="application-comment">
                                                Internt notat
                                            </Label>
                                            <Textarea
                                                id="application-comment"
                                                rows={3}
                                                value={internalComment}
                                                onChange={(event) =>
                                                    setInternalComment(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Kun synlig for behandlere"
                                            />
                                        </div>

                                        {/* Bedriftshenvendelser get no automated decision
                                email — the Næringslivsminister answers them
                                directly — so offering a message would be a
                                field that goes nowhere. */}
                                        {isDecision &&
                                            !application.companyContact && (
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="application-message">
                                                        Melding til innsender
                                                    </Label>
                                                    <Textarea
                                                        id="application-message"
                                                        rows={3}
                                                        value={
                                                            messageToSubmitter
                                                        }
                                                        onChange={(event) =>
                                                            setMessageToSubmitter(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Valgfritt — blir med i e-posten om avgjørelsen"
                                                    />
                                                </div>
                                            )}

                                        <Button
                                            disabled={isSaving}
                                            onClick={() =>
                                                onSave({
                                                    status,
                                                    internalComment,
                                                    messageToSubmitter,
                                                })
                                            }
                                        >
                                            {isSaving ? <Spinner /> : null}
                                            Lagre
                                        </Button>
                                    </div>
                                </>
                            ) : null}
                        </DialogBody>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
