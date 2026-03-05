import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { cn } from "~/lib/utils";

type MarkdownRendererProps = {
    content: string;
    className?: string;
};

export function MarkdownRenderer({
    content,
    className,
}: MarkdownRendererProps) {
    return (
        <div
            className={cn(
                "prose prose-neutral dark:prose-invert max-w-none",
                className,
            )}
        >
            <Markdown rehypePlugins={[rehypeRaw]}>{content}</Markdown>
        </div>
    );
}
