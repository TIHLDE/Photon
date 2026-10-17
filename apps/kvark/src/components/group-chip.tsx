import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Text } from "@tihlde/ui/ui/text";

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
            <Avatar className="size-16 rounded-xl">
                {logoUrl ? (
                    <AvatarImage src={avatarImageUrl(logoUrl)} alt={name} />
                ) : null}
                <AvatarFallback className="rounded-xl">
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <Text render={<span />} size="xs" className="w-full truncate">
                {name}
            </Text>
        </a>
    );
}
