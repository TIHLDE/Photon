import { Badge } from "@tihlde/ui/ui/badge";
import { Github, Linkedin } from "lucide-react";

import type { ProfileLink } from "#/components/profile-header";

type ProfileLinksSectionProps = {
    links: ProfileLink[];
};

export function ProfileLinksSection({ links }: ProfileLinksSectionProps) {
    if (links.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 md:hidden">
            <h3 className="text-xs text-muted-foreground">LENKER</h3>
            <div className="flex flex-wrap items-center gap-2">
                {links.map((link) => (
                    <Badge
                        key={link.kind}
                        variant="outline"
                        className="gap-1.5"
                        render={
                            link.url ? (
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                />
                            ) : undefined
                        }
                    >
                        {link.kind === "github" ? <Github /> : <Linkedin />}
                        {link.label}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
