import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MarkdownView, RichEditor } from "@tihlde/ui/complex/markdown";
import { Text } from "@tihlde/ui/ui/text";

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

| Route | Method | Description |
|-------|--------|-------------|
| /api/auth/sign-in | POST | Sign in with Feide |
| /api/auth/sign-out | POST | Sign out |
| /api/events | GET | List events |
| /api/events | POST | Create event |
| /api/events/:id | GET | Get event |

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
                <Text render={<h1 />} size="3xl">
                    Markdown playground
                </Text>
                <Text tone="muted">
                    Three registries, one shared markdown string. The rich
                    editor on the left is bound to the same state as the raw
                    textarea on the right; both update each other.
                </Text>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <Text render={<h2 />} size="lg">
                        Editor — rich registry
                    </Text>
                    <RichEditor
                        registry={richRegistry}
                        value={source}
                        onChange={setSource}
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <Text render={<h2 />} size="lg">
                        Editor — callout-only registry
                    </Text>
                    <RichEditor
                        registry={calloutOnlyRegistry}
                        value={source}
                        onChange={setSource}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Text render={<h2 />} size="lg">
                    Raw markdown
                </Text>
                <textarea
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    className="min-h-[20vh] w-full resize-y rounded border bg-background p-3 font-mono text-sm"
                    spellCheck={false}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                    <Text render={<h2 />} size="lg">
                        Rendered — rich
                    </Text>
                    <div className="rounded border p-4">
                        <MarkdownView registry={richRegistry} source={source} />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Text render={<h2 />} size="lg">
                        Rendered — callout-only
                    </Text>
                    <div className="rounded border p-4">
                        <MarkdownView
                            registry={calloutOnlyRegistry}
                            source={source}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Text render={<h2 />} size="lg">
                        Rendered — minimal
                    </Text>
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
