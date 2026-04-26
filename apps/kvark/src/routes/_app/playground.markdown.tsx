import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MarkdownView, RichEditor } from "@tihlde/ui/complex/markdown";

import {
    calloutOnlyRegistry,
    minimalRegistry,
    richRegistry,
} from "#/components/markdown/directives/presets";

export const Route = createFileRoute("/_app/playground/markdown")({
    component: MarkdownPlaygroundPage,
});

const SAMPLE = `# Markdown playground

Edit the markdown source on the right or use the editors on the left to see
how the **rich** registry (callouts + youtube), the **callout-only** registry,
and the **minimal** registry (no directives) all render the same source.

## Standard markdown

- *italic*, **bold**, ~~strike~~, \`inline code\`
- a [link](https://tihlde.org)
- a numbered list:
  1. one
  2. two

\`\`\`ts
function hello(name: string) {
    return \`Hello, \${name}\`;
}
\`\`\`

> A blockquote. Useful for emphasis.

## Directives

:::callout{type=info title="Did you know?"}
Container directives can hold **any** block content, including lists and code:

- like this
- and this
:::

:::callout{type=warn}
A callout without a title.
:::

:::callout{type=bogus}
A callout with an invalid \`type\` — the schema falls back to \`info\`.
:::

::youtube{id=dQw4w9WgXcQ}
`;

function MarkdownPlaygroundPage() {
    const [source, setSource] = useState(SAMPLE);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Markdown playground</h1>
                <p className="text-muted-foreground">
                    Three registries, one shared markdown string. The rich
                    editor on the left is bound to the same state as the raw
                    textarea on the right; both update each other.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Editor — rich registry</h2>
                    <RichEditor
                        registry={richRegistry}
                        value={source}
                        onChange={setSource}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Editor — callout-only registry</h2>
                    <RichEditor
                        registry={calloutOnlyRegistry}
                        value={source}
                        onChange={setSource}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-lg">Raw markdown</h2>
                <textarea
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    className="min-h-[20vh] w-full resize-y rounded border bg-background p-3 font-mono text-sm"
                    spellCheck={false}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Rendered — rich</h2>
                    <div className="rounded border p-4">
                        <MarkdownView registry={richRegistry} source={source} />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Rendered — callout-only</h2>
                    <div className="rounded border p-4">
                        <MarkdownView
                            registry={calloutOnlyRegistry}
                            source={source}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Rendered — minimal</h2>
                    <div className="rounded border p-4">
                        <MarkdownView
                            registry={minimalRegistry}
                            source={source}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
