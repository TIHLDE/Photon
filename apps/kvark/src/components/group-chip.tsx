import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";

export type GroupChipProps = {
    name: string;
    imageUrl?: string;
};

export function GroupChip({ name, imageUrl }: GroupChipProps) {
    return (
        <a
            href="#"
            className="flex w-20 shrink-0 flex-col items-center gap-2 text-center"
        >
            <Avatar className="size-16 rounded-xl">
                {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
                <AvatarFallback className="rounded-xl">
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="w-full truncate text-xs">{name}</span>
        </a>
    );
}
