import type { EmailTemplateOptions } from "@photon/email/templates";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { useEffect, useState } from "react";

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

    if (html === null) {
        return <Skeleton className="h-[560px] w-full" />;
    }

    return (
        <iframe
            title="Forhåndsvisning av e-posten"
            srcDoc={html}
            // Uten allow-same-origin får dokumentet en opak opprinnelse, og
            // logoen blir blokkert. Skript er fortsatt av.
            sandbox="allow-same-origin"
            className="h-[560px] w-full"
        />
    );
}
