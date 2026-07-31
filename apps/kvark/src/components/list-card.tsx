import { Badge } from "@tihlde/ui/ui/badge";
import { useRender } from "@tihlde/ui/hooks/use-render";
import { IMAGE_PRESETS } from "@tihlde/ui/ui/image-preset";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { DEFAULT_COVER_IMAGE } from "#/lib/image";

export type ListCardMetaRow = {
    icon: LucideIcon;
    text: ReactNode;
};

type ListCardProps = {
    render?: useRender.RenderProp;
    title: ReactNode;
    imageUrl?: string;
    imageAlt?: string;
    imageBadge?: ReactNode;
    meta: ListCardMetaRow[];
};

export function ListCard({
    render,
    title,
    imageUrl,
    imageAlt,
    imageBadge,
    meta,
}: ListCardProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            // Hover/press motion for this row lives in @tihlde/ui's styles.css
            // and is keyed off this slot, so it stays with the rest of the
            // motion system instead of as animation classes in this app.
            "data-slot": "list-card",
            className:
                "flex flex-col gap-3 overflow-hidden rounded-2xl bg-card sm:flex-row sm:gap-3 sm:overflow-visible sm:bg-transparent sm:p-2 sm:transition-colors sm:hover:bg-muted/50",
            children: (
                <>
                    {/*
                     * `self-start` keeps the media at its 16/7 ratio: as a
                     * flex child it would otherwise stretch to the row height,
                     * making covers taller on cards with more meta rows.
                     */}
                    <div
                        className={`relative ${IMAGE_PRESETS["cover-wide"].aspectClassName} w-full shrink-0 overflow-hidden rounded-t-2xl bg-muted sm:w-52 sm:self-start sm:rounded-lg`}
                    >
                        <img
                            src={imageUrl || DEFAULT_COVER_IMAGE}
                            alt={imageAlt ?? ""}
                            className="size-full object-cover"
                        />
                        {imageBadge ? (
                            <Badge className="absolute right-2 bottom-2">
                                {imageBadge}
                            </Badge>
                        ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 pb-3 sm:p-0">
                        {/*
                         * `line-clamp-1` over `truncate`: nowrap would let a
                         * long title set the row's max-content width and push
                         * the list wider than the viewport.
                         */}
                        <h3 className="line-clamp-1 text-lg sm:text-xl">
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
