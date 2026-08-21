import {
    GALLERY_DIRECTIVE,
    defineDirective,
} from "@tihlde/ui/complex/markdown";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Images } from "lucide-react";
import { z } from "zod";

const gallerySchema = z.object({});

// Et rutenett med like store ruter, to i bredden på mobil og tre fra og med
// nettbrett. Bildene beskjæres til samme format, så raden fyller bredden og
// stående og liggende bilder står like høyt — et galleri som ser bevisst ut,
// framfor en ujevn rad med dødplass til høyre.
const GALLERY_LAYOUT = [
    // Hvert bilde ligger i sitt eget avsnitt, slik markdown krever, og det
    // avsnittet er ruta i rutenettet. Da slipper vi å slåss med de usynlige
    // hjelpe-elementene editoren legger inn ved siden av bildet — de bor
    // inne i ruta og teller ikke som egne ruter.
    "grid grid-cols-2 gap-2 sm:grid-cols-3",
    // Editoren legger en egen beholder mellom galleriet og avsnittene.
    "[&>[data-node-view-content-react]]:contents",
    "[&_p]:my-0",
    "[&_img]:my-0 [&_img]:aspect-[4/3] [&_img]:size-full",
    "[&_img]:rounded-lg [&_img]:object-cover",
].join(" ");

export const gallery = defineDirective({
    name: GALLERY_DIRECTIVE,
    kind: "container",
    schema: gallerySchema,
    label: "Image gallery",
    icon: <Images className="size-4" />,
    inputRule: /^:::gallery\s$/,
    Render: ({ children }) => (
        <div data-slot="markdown-gallery" className={GALLERY_LAYOUT}>
            {children}
        </div>
    ),
    Edit: () => (
        <NodeViewWrapper>
            <div className="my-4 rounded-lg border border-dashed p-2">
                <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                    <Images className="size-4" />
                    <span>Image gallery</span>
                </div>
                <NodeViewContent
                    data-slot="markdown-gallery"
                    className={GALLERY_LAYOUT}
                />
            </div>
        </NodeViewWrapper>
    ),
});
