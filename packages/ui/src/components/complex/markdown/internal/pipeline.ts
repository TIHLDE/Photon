import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkBreaks from "remark-breaks";
import type { Root } from "mdast";

import { remarkSpacerParagraphs } from "./remark-spacer-paragraph";

/** A unified processor configured to parse markdown into a directive-aware mdast. */
export function createParser(): Processor<Root, Root, Root, Root, string> {
    // remarkBreaks: enkelt linjeskift blir et faktisk linjeskift, ikke et
    // mellomrom. Eldre innhold ble skrevet i et vanlig tekstfelt, der
    // markdown-regelen om at én enter er ingenting bare ser ut som en feil.
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkBreaks)
        .use(remarkDirective)
        .use(remarkSpacerParagraphs) as unknown as Processor<
        Root,
        Root,
        Root,
        Root,
        string
    >;
}

/** A unified processor configured to stringify a directive-aware mdast back to markdown. */
export function createStringifier(): Processor<
    undefined,
    undefined,
    Root,
    Root,
    string
> {
    return unified()
        .use(remarkStringify, {
            bullet: "-",
            emphasis: "*",
            fences: true,
            listItemIndent: "one",
            rule: "-",
        })
        .use(remarkGfm)
        .use(remarkDirective) as unknown as Processor<
        undefined,
        undefined,
        Root,
        Root,
        string
    >;
}

export function parseMarkdown(markdown: string): Root {
    const processor = createParser();
    // `parse()` kjører bare selve parseren. Både remarkBreaks og oppryddingen
    // av blanke avsnitt er transformer, og de må kjøres med `runSync` — ellers
    // ser editoren et annet tre enn `<MarkdownView>` gjør av samme tekst.
    return processor.runSync(processor.parse(markdown));
}

export function stringifyMdast(tree: Root): string {
    const out = createStringifier().stringify(tree);
    return out.trimEnd() + "\n";
}
