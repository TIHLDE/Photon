import { Mail, User } from "lucide-react";

import { avatarImageUrl } from "#/lib/assets";
import { Text } from "@tihlde/ui/ui/text";

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
                <Text render={<span />} weight="medium" className="truncate">
                    {name}
                </Text>
                {leader ? (
                    <Text
                        render={<span />}
                        tone="muted"
                        className="flex items-center gap-1 truncate"
                    >
                        <User className="size-3 shrink-0" />
                        <span className="truncate">{leader}</span>
                    </Text>
                ) : null}
                {email ? (
                    <Text
                        render={<span />}
                        tone="muted"
                        className="flex items-center gap-1 truncate"
                    >
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{email}</span>
                    </Text>
                ) : null}
            </div>
        </>
    );
}
