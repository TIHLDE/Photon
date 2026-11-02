import { Badge } from "@tihlde/ui/ui/badge";
import { useRender } from "@tihlde/ui/hooks/use-render";
import { IMAGE_PRESETS } from "@tihlde/ui/ui/image-preset";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { assetImageProps } from "#/lib/assets";
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
    /** Status ved siden av tittelen, f.eks. ventelisteplassen din. */
    titleBadge?: ReactNode;
    meta: ListCardMetaRow[];
};

export function ListCard({
    render,
    title,
    imageUrl,
    imageAlt,
    imageBadge,
    titleBadge,
    meta,
}: ListCardProps) {
    return useRender({
        render: render ?? <div />,
        props: {
            "data-slot": "list-card",
            // A flat row, not a card: a muted surface appears behind it on
            // hover. The negative margin lets that surface bleed outwards so
            // the content still lines up with the page. Lists of these rows
            // use no gap, so the vertical padding carries the spacing and the
            // pointer never falls into a dead gap between two rows.
            className:
                "-mx-2 flex flex-col gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-muted sm:flex-row",
            children: (
                <>
                    {/*
                     * `self-start` keeps the media at its 21/9 ratio: as a
                     * flex child it would otherwise stretch to the row height,
                     * making covers taller on cards with more meta rows.
                     */}
                    <div
                        className={`relative ${IMAGE_PRESETS["cover-wide"].aspectClassName} w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-52 sm:self-start`}
                    >
                        <img
                            {...assetImageProps(
                                imageUrl || DEFAULT_COVER_IMAGE,
                                "listRow",
                            )}
                            alt={imageAlt ?? ""}
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                        />
                        {imageBadge ? (
                            <Badge className="absolute right-2 bottom-2">
                                {imageBadge}
                            </Badge>
                        ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        {/*
                         * `line-clamp-1` over `truncate`: nowrap would let a
                         * long title set the row's max-content width and push
                         * the list wider than the viewport.
                         */}
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="line-clamp-1 text-lg sm:text-xl">
                                {title}
                            </h3>
                            {titleBadge ? (
                                <div className="shrink-0">{titleBadge}</div>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            {meta.map((row, i) => (
                                // `min-w-0`: uten den setter et langt stedsnavn
                                // radens minstebredde, og `truncate` på
                                // spennet under får aldri slå inn.
                                <div
                                    key={i}
                                    className="flex min-w-0 items-center gap-2"
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
