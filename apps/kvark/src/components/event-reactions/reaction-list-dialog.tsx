import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { ScrollArea } from "@tihlde/ui/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { List } from "lucide-react";

import { avatarImageUrl } from "#/lib/assets";
import { initials } from "#/lib/utils";

import type { EventReactionItem, ReactionGroup } from "./group-reactions";

const ALL_TAB = "all";

type ReactionListDialogProps = {
    reactions: EventReactionItem[];
    groups: ReactionGroup[];
};

/** Alle som har reagert, med én fane per emoji. */
export function ReactionListDialog({
    reactions,
    groups,
}: ReactionListDialogProps) {
    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Vis alle reaksjoner"
                    />
                }
            >
                <List />
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Reaksjoner</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue={ALL_TAB} className="min-w-0">
                    <div className="max-w-full overflow-x-auto">
                        <TabsList>
                            <TabsTrigger value={ALL_TAB}>
                                Alle ({reactions.length})
                            </TabsTrigger>
                            {groups.map((group) => (
                                <TabsTrigger
                                    key={group.emoji}
                                    value={group.emoji}
                                >
                                    {group.emoji} ({group.reactions.length})
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <TabsContent value={ALL_TAB}>
                        <ReactorList reactions={reactions} />
                    </TabsContent>
                    {groups.map((group) => (
                        <TabsContent key={group.emoji} value={group.emoji}>
                            <ReactorList reactions={group.reactions} />
                        </TabsContent>
                    ))}
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function ReactorList({ reactions }: { reactions: EventReactionItem[] }) {
    return (
        <ScrollArea className="max-h-96">
            <div className="flex flex-col gap-1">
                {reactions.map((reaction) => (
                    <Button
                        key={reaction.user.id}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 p-2 text-left"
                        render={
                            <Link
                                to="/profil/$id"
                                params={{ id: reaction.user.id }}
                            />
                        }
                    >
                        <Avatar>
                            {reaction.user.image ? (
                                <AvatarImage
                                    src={avatarImageUrl(reaction.user.image)}
                                    alt={reaction.user.name}
                                />
                            ) : null}
                            <AvatarFallback>
                                {initials(reaction.user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">
                            {reaction.user.name}
                        </span>
                        <span>{reaction.emoji}</span>
                    </Button>
                ))}
            </div>
        </ScrollArea>
    );
}
