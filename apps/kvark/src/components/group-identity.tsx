import { Mail, User } from "lucide-react";

import { avatarImageUrl } from "#/lib/assets";

export type GroupIdentityProps = {
    name: string;
    leader?: string;
    email?: string;
    logoUrl?: string;
};

export function GroupIdentity({
    name,
    leader,
    email,
    logoUrl,
}: GroupIdentityProps) {
    return (
        <>
            {logoUrl ? (
                <img
                    alt={name}
                    className="size-16 shrink-0 rounded-lg object-cover"
                    src={avatarImageUrl(logoUrl)}
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                    {name.slice(0, 2).toUpperCase()}
                </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate font-medium">{name}</span>
                {leader ? (
                    <span className="flex items-center gap-1 truncate text-muted-foreground">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">{leader}</span>
                    </span>
                ) : null}
                {email ? (
                    <span className="flex items-center gap-1 truncate text-muted-foreground">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{email}</span>
                    </span>
                ) : null}
            </div>
        </>
    );
}
