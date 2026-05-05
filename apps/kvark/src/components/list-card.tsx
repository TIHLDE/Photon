import { Badge } from "@tihlde/ui/ui/badge";
import { useRender } from "@tihlde/ui/hooks/use-render";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ListCardMetaRow = {
    icon: LucideIcon;
    text: ReactNode;
};

type ListCardProps = {
    render?: useRender.RenderProp;
    title: ReactNode;
    imageUrl?: string;
    imageBadge?: ReactNode;
    meta: ListCardMetaRow[];
};

export function ListCard({
    render,
    title,
    imageUrl,
    imageBadge,
    meta,
}: ListCardProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            className:
                "flex flex-col gap-3 overflow-hidden rounded-2xl bg-card sm:flex-row sm:gap-3 sm:overflow-visible sm:bg-transparent sm:p-2 sm:transition-colors sm:hover:bg-muted/50",
            children: (
                <>
                    <div className="relative aspect-[16/7] w-full shrink-0 overflow-hidden rounded-t-2xl bg-muted sm:w-52 sm:rounded-lg">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : null}
                        {imageBadge ? (
                            <Badge className="absolute right-2 bottom-2">
                                {imageBadge}
                            </Badge>
                        ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-3 sm:p-0">
                        <h3 className="line-clamp-2 text-lg sm:text-xl">
                            {title}
                        </h3>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            {meta.map((row, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2"
                                >
                                    <row.icon className="size-4 shrink-0" />
                                    <span className="truncate">{row.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ),
        },
    });
}
