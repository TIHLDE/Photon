import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import type { Root } from "mdast";

/** A unified processor configured to parse markdown into a directive-aware mdast. */
export function createParser(): Processor<Root, Root, Root, Root, string> {
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkDirective) as unknown as Processor<
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
    return createParser().parse(markdown);
}

export function stringifyMdast(tree: Root): string {
    const out = createStringifier().stringify(tree);
    return out.trimEnd() + "\n";
}
