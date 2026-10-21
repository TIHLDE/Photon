import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { Check, Copy, Mail, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type GroupJoinDialogProps = {
    groupName: string;
    contactEmail: string;
    /** Navnet e-posten signeres med. Tomt når ingen er logget inn. */
    senderName?: string;
};

/**
 * Viser en ferdig skrevet e-post til gruppa i stedet for å åpne `mailto:`
 * direkte: de fleste har ikke satt opp et e-postprogram, og da skjer det
 * ingenting når lenken trykkes. Her vises e-posten med kopiknapper, og lenker
 * til de vanligste webmail-tjenestene den kan limes inn i.
 */
/**
 * Ett felt i e-posten, med en knapp som kopierer det. Lar e-posten limes inn
 * i den kontoen man allerede har åpen, uansett hvilken tjeneste det er.
 */
function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        },
        [],
    );

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            if (resetTimer.current) clearTimeout(resetTimer.current);
            resetTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Utklippstavla er blokkert; teksten står synlig og kan
            // markeres for hånd.
        }
    }

    return (
        <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="wrap-anywhere whitespace-pre-wrap">{value}</dd>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={
                    copied
                        ? `${label}-feltet kopiert`
                        : `Kopier ${label}-feltet`
                }
                onClick={() => void copy()}
            >
                {copied ? <Check /> : <Copy />}
            </Button>
        </div>
    );
}

const WEBMAIL_PROVIDERS = [
    {
        label: "Gmail",
        href: "https://mail.google.com/mail/u/0/#inbox?compose=new",
    },
    { label: "Outlook", href: "https://outlook.office.com/mail/" },
];

export function GroupJoinDialog({
    groupName,
    contactEmail,
    senderName,
}: GroupJoinDialogProps) {
    const subject = `Bli med i ${groupName}`;
    const body = [
        "Hei,",
        "",
        "Jeg vil gjerne bli med i interessegruppen.",
        "",
        "Hilsen",
        senderName ?? "",
    ]
        .join("\n")
        .trimEnd();

    const su = encodeURIComponent(subject);
    const text = encodeURIComponent(body);

    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button>
                        <UserPlus />
                        Bli med i denne interessegruppen
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Bli med i {groupName}</DialogTitle>
                    <DialogDescription>
                        Send en e-posten til gruppeleder. Eller kontakt dem
                        direkte for å bli med.
                    </DialogDescription>
                </DialogHeader>
                <dl className="flex flex-col gap-3 text-sm">
                    <CopyField label="Til" value={contactEmail} />
                    <CopyField label="Emne" value={subject} />
                    <CopyField label="Melding" value={body} />
                </dl>
                <DialogFooter>
                    <div className="grid w-full gap-2 sm:grid-cols-3">
                        {WEBMAIL_PROVIDERS.map((provider) => (
                            <Button
                                key={provider.label}
                                variant="outline"
                                render={
                                    <a
                                        href={provider.href}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                }
                            >
                                {provider.label}
                            </Button>
                        ))}
                        <Button
                            variant="outline"
                            render={
                                <a
                                    href={`mailto:${contactEmail}?subject=${su}&body=${text}`}
                                />
                            }
                        >
                            <Mail />
                            E-postprogram
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
