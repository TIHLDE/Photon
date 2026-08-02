import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Input } from "@tihlde/ui/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@tihlde/ui/ui/popover";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export type UserSearchOption = {
    id: string;
    name: string | null;
    username?: string | null;
    image: string | null;
};

type UserSearchComboboxProps = {
    /** Currently selected/assigned user shown on the trigger, or null. */
    holder: { name: string | null; image: string | null } | null;
    query: string;
    onQueryChange: (query: string) => void;
    results: UserSearchOption[];
    isSearching?: boolean;
    onSelect: (user: UserSearchOption) => void;
    /** When set, shows a remove action for the current holder. */
    onRemove?: () => void;
    onOpenChange?: (open: boolean) => void;
    placeholder?: string;
    emptyLabel?: string;
};

/**
 * Popover combobox for picking a user by searching on name/username.
 * Dumb component: the parent owns the query state and result fetching.
 */
export function UserSearchCombobox({
    holder,
    query,
    onQueryChange,
    results,
    isSearching = false,
    onSelect,
    onRemove,
    onOpenChange,
    placeholder = "Søk på navn eller brukernavn…",
    emptyLabel = "Ingen tildelt",
}: UserSearchComboboxProps) {
    const [open, setOpen] = useState(false);
    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        onOpenChange?.(next);
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger className="flex cursor-pointer items-center gap-2">
                {holder ? (
                    <>
                        <Avatar className="size-7">
                            <AvatarImage
                                src={avatarImageUrl(holder.image ?? undefined)}
                            />
                            <AvatarFallback>
                                {initials(holder.name ?? "?")}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{holder.name}</span>
                    </>
                ) : (
                    <span className="text-sm text-muted-foreground">
                        {emptyLabel}
                    </span>
                )}
                <ChevronDownIcon className="size-4 opacity-60" />
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={4}
                className="flex w-72 flex-col gap-2 p-2"
            >
                <Input
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                />
                {isSearching ? (
                    <span className="px-1 text-xs text-muted-foreground">
                        Søker…
                    </span>
                ) : null}
                {!isSearching &&
                query.trim().length >= 2 &&
                results.length === 0 ? (
                    <span className="px-1 text-xs text-muted-foreground">
                        Ingen treff
                    </span>
                ) : null}
                {results.length > 0 ? (
                    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                        {results.map((user) => (
                            <li key={user.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect(user);
                                        handleOpenChange(false);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 p-1 text-left"
                                >
                                    <Avatar className="size-7">
                                        <AvatarImage
                                            src={avatarImageUrl(
                                                user.image ?? undefined,
                                            )}
                                        />
                                        <AvatarFallback>
                                            {initials(user.name ?? "?")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm font-medium">
                                            {user.name}
                                        </span>
                                        {user.username ? (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {user.username}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {holder && onRemove ? (
                    <button
                        type="button"
                        onClick={() => {
                            onRemove();
                            handleOpenChange(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 p-1 text-left text-sm text-destructive"
                    >
                        <XIcon className="size-4" />
                        Fjern {holder.name}
                    </button>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
