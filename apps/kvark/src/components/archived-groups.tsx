import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { GroupIdentity } from "#/components/group-identity";
import type { SimpleSection } from "#/lib/build-group-tree";
import { cn } from "#/lib/utils";

export function ArchivedGroups({ groups }: { groups: SimpleSection["items"] }) {
    const [open, setOpen] = useState(false);

    if (groups.length === 0) return null;

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
                render={
                    <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 text-left"
                    />
                }
            >
                <h2 className="text-lg font-semibold">
                    Arkiverte grupper ({groups.length})
                </h2>
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 transition-transform",
                        open && "rotate-180",
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-2 px-px pt-3 pb-px sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                    <Link
                        key={group.slug}
                        className="block min-w-0 cursor-pointer"
                        to="/grupper/$slug"
                        params={{ slug: group.slug }}
                    >
                        <Card size="sm" muted className="h-full cursor-pointer">
                            <CardContent className="flex items-center gap-3">
                                <GroupIdentity {...group} />
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
