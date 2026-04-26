import { defineDirective } from "@tihlde/ui/complex/markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Info } from "lucide-react";
import { z } from "zod";

const calloutSchema = z.object({
    type: z.enum(["info", "warn", "danger"]).catch("info").default("info"),
    title: z.string().optional(),
});

export const callout = defineDirective({
    name: "callout",
    kind: "container",
    schema: calloutSchema,
    label: "Callout",
    icon: <Info className="size-4" />,
    inputRule: /^:::callout\s$/,
    Render: ({ attrs, children }) => (
        <Card data-callout-type={attrs.type}>
            {attrs.title ? (
                <CardHeader>
                    <CardTitle>{attrs.title}</CardTitle>
                </CardHeader>
            ) : null}
            <CardContent className="flex flex-col gap-2">
                {children}
            </CardContent>
        </Card>
    ),
    Edit: ({ attrs }) => (
        <NodeViewWrapper>
            <Card data-callout-type={attrs.type}>
                {attrs.title ? (
                    <CardHeader>
                        <CardTitle>{attrs.title}</CardTitle>
                    </CardHeader>
                ) : null}
                <CardContent className="flex flex-col gap-2">
                    <NodeViewContent />
                </CardContent>
            </Card>
        </NodeViewWrapper>
    ),
});
