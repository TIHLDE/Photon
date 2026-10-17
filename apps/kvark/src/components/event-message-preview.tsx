import type { EmailTemplateOptions } from "@photon/email/templates";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { useEffect, useRef, useState } from "react";

type Templates = typeof import("@photon/email/templates");

/**
 * E-posten slik den blir sendt. Bygges i nettleseren fra den samme malen som
 * API-et bruker, så forhåndsvisningen kan ikke skli fra det som går ut.
 */
export function EventMessagePreview(
    props: EmailTemplateOptions<"EventMessageEmail">,
) {
    const [templates, setTemplates] = useState<Templates | null>(null);
    const [html, setHtml] = useState<string | null>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let isCurrent = true;
        void import("@photon/email/templates").then((module) => {
            if (isCurrent) setTemplates(module);
        });
        return () => {
            isCurrent = false;
        };
    }, []);

    const { title, body, eventTitle, senderName, link, logoUrl } = props;

    useEffect(() => {
        if (!templates) return;
        let isCurrent = true;
        void templates
            .renderEmailTemplate("EventMessageEmail", {
                title,
                body,
                eventTitle,
                senderName,
                link,
                logoUrl,
            })
            .then((rendered) => {
                if (isCurrent) setHtml(rendered);
            });
        return () => {
            isCurrent = false;
        };
    }, [templates, title, body, eventTitle, senderName, link, logoUrl]);

    // Ny srcDoc laster hele dokumentet på nytt for hvert tastetrykk, og det
    // blinker. Dokumentet skrives derfor én gang, og bare body byttes etterpå.
    useEffect(() => {
        const doc = frameRef.current?.contentDocument;
        if (!doc || html === null) return;

        if (doc.body?.childElementCount) {
            const next = new DOMParser().parseFromString(html, "text/html");
            doc.body.replaceWith(doc.importNode(next.body, true));
            return;
        }

        writeDocument(doc, html);
    }, [html]);

    // Noen nettlesere bytter ut det tomme startdokumentet etter at vi har
    // skrevet til det, så et tomt dokument ved load skrives på nytt.
    function handleLoad() {
        const doc = frameRef.current?.contentDocument;
        if (!doc || html === null || doc.body?.childElementCount) return;
        writeDocument(doc, html);
    }

    if (html === null) {
        return <Skeleton className="h-[560px] w-full" />;
    }

    return (
        <iframe
            title="Forhåndsvisning av e-posten"
            ref={frameRef}
            onLoad={handleLoad}
            // Uten allow-same-origin får dokumentet en opak opprinnelse, og
            // logoen blir blokkert. Skript er fortsatt av.
            sandbox="allow-same-origin"
            className="h-[560px] w-full"
        />
    );
}

function writeDocument(doc: Document, html: string) {
    doc.open();
    doc.write(html);
    doc.close();
}
