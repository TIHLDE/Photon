import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";

import { avatarImageUrl } from "#/lib/assets";

export type GroupChipProps = {
    name: string;
    logoUrl?: string;
};

export function GroupChip({ name, logoUrl }: GroupChipProps) {
    return (
        <a
            href="#"
            className="flex w-20 shrink-0 flex-col items-center gap-2 text-center"
        >
            <Avatar shape="rounded" className="size-16">
                {logoUrl ? (
                    <AvatarImage src={avatarImageUrl(logoUrl)} alt={name} />
                ) : null}
                <AvatarFallback shape="rounded">
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="w-full truncate text-xs">{name}</span>
        </a>
    );
}
