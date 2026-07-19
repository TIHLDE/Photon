import { defineDirective } from "@tihlde/ui/complex/markdown";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { NodeViewWrapper } from "@tiptap/react";
import { Video as YoutubeIcon } from "lucide-react";
import { z } from "zod";

const youtubeSchema = z.object({
    id: z.string().min(1),
});

const ID_PATTERN = /^[a-zA-Z0-9_-]{6,32}$/;

function safeEmbedUrl(id: string): string | null {
    if (!ID_PATTERN.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
}

export const youtube = defineDirective({
    name: "youtube",
    kind: "leaf",
    schema: youtubeSchema,
    label: "YouTube embed",
    icon: <YoutubeIcon className="size-4" />,
    Render: ({ attrs }) => {
        const url = safeEmbedUrl(attrs.id);
        if (!url) return null;
        return (
            <Card>
                <CardContent className="flex flex-col gap-2">
                    <div className="aspect-video w-full">
                        <iframe
                            src={url}
                            title="YouTube video"
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                </CardContent>
            </Card>
        );
    },
    Edit: ({ attrs }) => {
        const url = safeEmbedUrl(attrs.id);
        return (
            <NodeViewWrapper>
                <Card>
                    <CardContent className="flex flex-col gap-2 p-3">
                        <div className="flex items-center gap-2">
                            <YoutubeIcon className="size-4" />
                            <span className="text-sm">YouTube</span>
                        </div>
                        {url ? (
                            <div className="aspect-video w-full">
                                <iframe
                                    src={url}
                                    title="YouTube video"
                                    className="pointer-events-none h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                />
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                Set a YouTube video id to preview.
                            </span>
                        )}
                    </CardContent>
                </Card>
            </NodeViewWrapper>
        );
    },
});
