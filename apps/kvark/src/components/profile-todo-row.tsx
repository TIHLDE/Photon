import { Button } from "@tihlde/ui/ui/button";
import { Card } from "@tihlde/ui/ui/card";
import { HelpCircle } from "lucide-react";

export type ProfileTodoRowProps = {
    title: string;
    meta: string;
    action: string;
};

export function ProfileTodoRow({ title, meta, action }: ProfileTodoRowProps) {
    return (
        <Card size="sm" className="flex-row items-center gap-3">
            <div
                className="ml-3 flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"
                aria-hidden
            >
                <HelpCircle className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{title}</span>
                <span className="truncate text-sm text-muted-foreground">
                    {meta}
                </span>
            </div>
            <div className="pr-3">
                <Button size="sm">{action}</Button>
            </div>
        </Card>
    );
}
