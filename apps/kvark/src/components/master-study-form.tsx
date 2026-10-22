import { nb } from "date-fns/locale";
import { PlusIcon, Trash2, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { MasterStudyEntry } from "@tihlde/sdk";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { DateTimePicker } from "@tihlde/ui/ui/date-time-picker";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Switch } from "@tihlde/ui/ui/switch";
import { Textarea } from "@tihlde/ui/ui/textarea";

import {
    LOCATION_TYPE_LABELS,
    type MasterStudyLocationType,
} from "#/lib/master-study";

export type MasterStudyQuoteDraft = {
    key: string;
    name: string;
    quote: string;
};

export type MasterStudyFormValues = {
    studyProgramId: string;
    name: string;
    location: string;
    locationType: MasterStudyLocationType;
    link: string;
    applicationDeadline: Date | null;
    hasFinancialSupport: boolean;
    financialSupport: string;
    summary: string;
    subjectRequirements: string;
    otherRequirements: string;
    quotes: MasterStudyQuoteDraft[];
};

let quoteKey = 0;
function newQuoteDraft(
    quote: { name: string | null; quote: string } = { name: null, quote: "" },
): MasterStudyQuoteDraft {
    quoteKey += 1;
    return { key: `q${quoteKey}`, name: quote.name ?? "", quote: quote.quote };
}

export const emptyMasterStudyFormValues: MasterStudyFormValues = {
    studyProgramId: "",
    name: "",
    location: "",
    locationType: "innland",
    link: "",
    applicationDeadline: null,
    hasFinancialSupport: false,
    financialSupport: "",
    summary: "",
    subjectRequirements: "",
    otherRequirements: "",
    quotes: [],
};

export function masterStudyFormValues(
    entry: MasterStudyEntry,
): MasterStudyFormValues {
    return {
        studyProgramId: String(entry.studyProgramId),
        name: entry.name,
        location: entry.location,
        locationType: entry.locationType,
        link: entry.link,
        applicationDeadline: entry.applicationDeadline
            ? new Date(entry.applicationDeadline)
            : null,
        hasFinancialSupport: entry.hasFinancialSupport,
        financialSupport: entry.financialSupport ?? "",
        summary: entry.summary ?? "",
        subjectRequirements: entry.subjectRequirements ?? "",
        otherRequirements: entry.otherRequirements ?? "",
        quotes: entry.quotes.map((q) => newQuoteDraft(q)),
    };
}

/** Same rule as the API: any http(s) address. */
function isWebLink(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

/** The first problem the API would reject, or null when the form is ready. */
export function validateMasterStudyForm(
    values: MasterStudyFormValues,
): string | null {
    if (!values.studyProgramId) {
        return "Velg hvilket studieprogram masterstudiet bygger på.";
    }
    if (!isWebLink(values.link.trim())) {
        return "Lenken må være en nettadresse som starter med https://.";
    }
    if (values.quotes.some((q) => !q.quote.trim())) {
        return "Et sitat kan ikke være tomt. Fjern det eller fyll det ut.";
    }
    return null;
}

type MasterStudyFormProps = {
    values: MasterStudyFormValues;
    onChange: (patch: Partial<MasterStudyFormValues>) => void;
    programs: { id: number; displayName: string }[];
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    submitLabel: string;
    isSubmitting: boolean;
    /** Rendered left of the submit button, e.g. a delete button. */
    secondaryAction?: ReactNode;
    /** Rendered above the buttons, e.g. error alerts. */
    children?: ReactNode;
};

export function MasterStudyForm({
    values,
    onChange,
    programs,
    onSubmit,
    submitLabel,
    isSubmitting,
    secondaryAction,
    children,
}: MasterStudyFormProps) {
    const programItems = programs.map((p) => ({
        value: String(p.id),
        label: p.displayName,
    }));
    const locationItems = (["innland", "utland"] as const).map((value) => ({
        value,
        label: LOCATION_TYPE_LABELS[value],
    }));

    function updateQuote(key: string, patch: Partial<MasterStudyQuoteDraft>) {
        onChange({
            quotes: values.quotes.map((q) =>
                q.key === key ? { ...q, ...patch } : q,
            ),
        });
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Detaljer</CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="ms-name">
                                    Navn *
                                </FieldLabel>
                                <Input
                                    id="ms-name"
                                    required
                                    maxLength={300}
                                    placeholder="Master i informatikk"
                                    value={values.name}
                                    onChange={(e) =>
                                        onChange({ name: e.target.value })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-program">
                                    Bygger på studieprogram *
                                </FieldLabel>
                                <Select
                                    items={programItems}
                                    value={values.studyProgramId || null}
                                    onValueChange={(value) =>
                                        onChange({
                                            studyProgramId: value ?? "",
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="ms-program"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Velg studieprogram" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {programItems.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="ms-location">
                                    Sted *
                                </FieldLabel>
                                <Input
                                    id="ms-location"
                                    required
                                    maxLength={300}
                                    placeholder="NTNU Trondheim"
                                    value={values.location}
                                    onChange={(e) =>
                                        onChange({ location: e.target.value })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-location-type">
                                    Innland/utland *
                                </FieldLabel>
                                <Select
                                    items={locationItems}
                                    value={values.locationType}
                                    onValueChange={(value) =>
                                        onChange({
                                            locationType:
                                                (value as MasterStudyLocationType) ??
                                                "innland",
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="ms-location-type"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locationItems.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="ms-url">
                                    Lenke til studiet *
                                </FieldLabel>
                                <Input
                                    id="ms-url"
                                    type="url"
                                    required
                                    maxLength={500}
                                    placeholder="https://…"
                                    value={values.link}
                                    onChange={(e) =>
                                        onChange({ link: e.target.value })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-deadline">
                                    Søknadsfrist
                                </FieldLabel>
                                <div className="flex items-center gap-2">
                                    <DateTimePicker
                                        id="ms-deadline"
                                        locale={nb}
                                        placeholder="Ikke oppgitt"
                                        value={values.applicationDeadline}
                                        onValueChange={(value) =>
                                            onChange({
                                                applicationDeadline: value,
                                            })
                                        }
                                    />
                                    {values.applicationDeadline ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Fjern søknadsfrist"
                                            onClick={() =>
                                                onChange({
                                                    applicationDeadline: null,
                                                })
                                            }
                                        >
                                            <XIcon />
                                        </Button>
                                    ) : null}
                                </div>
                            </Field>
                        </div>
                        <Field orientation="horizontal">
                            <Switch
                                id="ms-support"
                                checked={values.hasFinancialSupport}
                                onCheckedChange={(checked) =>
                                    onChange({ hasFinancialSupport: checked })
                                }
                            />
                            <FieldLabel htmlFor="ms-support">
                                Økonomisk støtte tilgjengelig
                            </FieldLabel>
                        </Field>
                        {values.hasFinancialSupport ? (
                            <Field>
                                <FieldLabel htmlFor="ms-support-details">
                                    Om støtten
                                </FieldLabel>
                                <Textarea
                                    id="ms-support-details"
                                    placeholder="Stipend, Lånekassen, dekning av skolepenger …"
                                    value={values.financialSupport}
                                    onChange={(e) =>
                                        onChange({
                                            financialSupport: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                        ) : null}
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Beskrivelse</CardTitle>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="ms-summary">
                                Om studiet
                            </FieldLabel>
                            <Textarea
                                id="ms-summary"
                                rows={6}
                                value={values.summary}
                                onChange={(e) =>
                                    onChange({ summary: e.target.value })
                                }
                            />
                            <FieldDescription>
                                Støtter Markdown.
                            </FieldDescription>
                        </Field>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="ms-subject-req">
                                    Fagkrav
                                </FieldLabel>
                                <Textarea
                                    id="ms-subject-req"
                                    rows={4}
                                    value={values.subjectRequirements}
                                    onChange={(e) =>
                                        onChange({
                                            subjectRequirements: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-other-req">
                                    Øvrige krav
                                </FieldLabel>
                                <Textarea
                                    id="ms-other-req"
                                    rows={4}
                                    value={values.otherRequirements}
                                    onChange={(e) =>
                                        onChange({
                                            otherRequirements: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </div>
                    </FieldGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sitater</CardTitle>
                    <CardDescription>
                        Erfaringer fra de som har tatt studiet. La navnet stå
                        tomt for et anonymt sitat.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {values.quotes.map((quote, index) => (
                        <Card key={quote.key} size="sm">
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex items-end gap-2">
                                    <Field className="flex-1">
                                        <FieldLabel
                                            htmlFor={`${quote.key}-name`}
                                        >
                                            Navn
                                        </FieldLabel>
                                        <Input
                                            id={`${quote.key}-name`}
                                            maxLength={200}
                                            placeholder="Anonym"
                                            value={quote.name}
                                            onChange={(e) =>
                                                updateQuote(quote.key, {
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Fjern sitat ${index + 1}`}
                                        onClick={() =>
                                            onChange({
                                                quotes: values.quotes.filter(
                                                    (q) => q.key !== quote.key,
                                                ),
                                            })
                                        }
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                                <Field>
                                    <FieldLabel htmlFor={`${quote.key}-quote`}>
                                        Sitat
                                    </FieldLabel>
                                    <Textarea
                                        id={`${quote.key}-quote`}
                                        required
                                        value={quote.quote}
                                        onChange={(e) =>
                                            updateQuote(quote.key, {
                                                quote: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </CardContent>
                        </Card>
                    ))}
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                onChange({
                                    quotes: [...values.quotes, newQuoteDraft()],
                                })
                            }
                        >
                            <PlusIcon className="size-4" />
                            Legg til sitat
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {children}

            <div className="flex justify-end gap-2">
                {secondaryAction}
                <Button type="submit" disabled={isSubmitting}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}

/**
 * The form as an API body. Blank fields mean «ikke oppgitt» and come out as
 * null, so an edit actually clears an earlier value.
 */
export function masterStudyPayload(values: MasterStudyFormValues) {
    const text = (value: string) => value.trim() || null;
    return {
        studyProgramId: Number(values.studyProgramId),
        name: values.name.trim(),
        location: values.location.trim(),
        locationType: values.locationType,
        link: values.link.trim(),
        hasFinancialSupport: values.hasFinancialSupport,
        financialSupport: values.hasFinancialSupport
            ? text(values.financialSupport)
            : null,
        summary: text(values.summary),
        subjectRequirements: text(values.subjectRequirements),
        otherRequirements: text(values.otherRequirements),
        applicationDeadline: values.applicationDeadline
            ? values.applicationDeadline.toISOString()
            : null,
        quotes: values.quotes.map((q) => ({
            name: q.name.trim() || null,
            quote: q.quote.trim(),
        })),
    };
}
