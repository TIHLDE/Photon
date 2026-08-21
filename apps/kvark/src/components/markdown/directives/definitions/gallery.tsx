import {
    GALLERY_DIRECTIVE,
    defineDirective,
} from "@tihlde/ui/complex/markdown";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Images } from "lucide-react";
import { z } from "zod";

const gallerySchema = z.object({});

// Bildene ligger hver for seg i et avsnitt, slik markdown krever. `contents`
// løser avsnittene opp i layouten, så bildene blir liggende side om side og
// brekker til neste rad når raden er full. Fast høyde og `w-auto` holder
// bildeformatet, så stående og liggende bilder står pent ved siden av
// hverandre uten å bli beskåret.
const GALLERY_LAYOUT = [
    // I editoren legger TipTap en egen beholder mellom galleriet og
    // avsnittene. Den løses opp på samme måte, ellers blir alt innholdet
    // liggende som ett eneste flex-element.
    "flex flex-wrap gap-2 [&_p]:contents",
    "[&>[data-node-view-content-react]]:contents",
    "[&_img]:my-0 [&_img]:h-40 [&_img]:w-auto [&_img]:max-w-full",
    "[&_img]:rounded-lg [&_img]:object-cover sm:[&_img]:h-56",
].join(" ");

export const gallery = defineDirective({
    name: GALLERY_DIRECTIVE,
    kind: "container",
    schema: gallerySchema,
    label: "Image gallery",
    icon: <Images className="size-4" />,
    inputRule: /^:::gallery\s$/,
    Render: ({ children }) => <div className={GALLERY_LAYOUT}>{children}</div>,
    Edit: () => (
        <NodeViewWrapper>
            <div className="my-4 rounded-lg border border-dashed p-2">
                <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                    <Images className="size-4" />
                    <span>Image gallery</span>
                </div>
                <NodeViewContent className={GALLERY_LAYOUT} />
            </div>
        </NodeViewWrapper>
    ),
});
