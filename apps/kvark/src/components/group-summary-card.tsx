import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Mail } from "lucide-react";

export type GroupSummaryCardProps = {
    name: string;
    leader: string;
    email: string;
    logoUrl?: string;
};

export function GroupSummaryCard({
    name,
    leader,
    email,
    logoUrl,
}: GroupSummaryCardProps) {
    return (
        <a
            href="#"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
        >
            <Avatar className="size-12 rounded-md">
                {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
                <AvatarFallback className="rounded-md">
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-muted-foreground">{leader}</span>
                <span className="flex items-center gap-1 truncate text-muted-foreground">
                    <Mail className="size-3" />
                    {email}
                </span>
            </div>
        </a>
    );
}
