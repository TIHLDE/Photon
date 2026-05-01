import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
    NodeViewContent,
    NodeViewWrapper,
    type NodeViewProps,
} from "@tiptap/react";
import {
    ArrowDownToLine,
    ArrowLeftToLine,
    ArrowRightToLine,
    ArrowUpToLine,
    Columns3Cog,
    Rows3,
    Trash2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "#/components/ui/tooltip";

export function TableNodeView({ editor, node, getPos }: NodeViewProps) {
    const active = useSelectionInside(editor, node, getPos);

    return (
        <NodeViewWrapper className="relative my-4">
            {active ? (
                <div
                    contentEditable={false}
                    className="absolute -top-11 left-0 z-10 flex items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm"
                >
                    <Action
                        label="Add column before"
                        onClick={() =>
                            editor.chain().focus().addColumnBefore().run()
                        }
                    >
                        <ArrowLeftToLine className="size-4" />
                    </Action>
                    <Action
                        label="Add column after"
                        onClick={() =>
                            editor.chain().focus().addColumnAfter().run()
                        }
                    >
                        <ArrowRightToLine className="size-4" />
                    </Action>
                    <Action
                        label="Delete column"
                        onClick={() =>
                            editor.chain().focus().deleteColumn().run()
                        }
                    >
                        <Columns3Cog className="size-4" />
                    </Action>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Action
                        label="Add row above"
                        onClick={() =>
                            editor.chain().focus().addRowBefore().run()
                        }
                    >
                        <ArrowUpToLine className="size-4" />
                    </Action>
                    <Action
                        label="Add row below"
                        onClick={() =>
                            editor.chain().focus().addRowAfter().run()
                        }
                    >
                        <ArrowDownToLine className="size-4" />
                    </Action>
                    <Action
                        label="Delete row"
                        onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                        <Rows3 className="size-4" />
                    </Action>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Action
                        label="Delete table"
                        onClick={() =>
                            editor.chain().focus().deleteTable().run()
                        }
                    >
                        <Trash2 className="size-4" />
                    </Action>
                </div>
            ) : null}
            <table className="w-full border-collapse [&_td]:border [&_td]:border-border [&_td]:min-w-32 [&_th]:border [&_th]:border-border [&_th]:min-w-32 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold">
                <NodeViewContent<"tbody"> as="tbody" />
            </table>
        </NodeViewWrapper>
    );
}

function Action({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClick}
                        aria-label={label}
                    >
                        {children}
                    </Button>
                }
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function useSelectionInside(
    editor: Editor,
    node: PMNode,
    getPos: () => number | undefined,
): boolean {
    const [active, setActive] = useState(() =>
        isSelectionInside(editor, node, getPos),
    );

    useEffect(() => {
        const update = () => setActive(isSelectionInside(editor, node, getPos));
        editor.on("selectionUpdate", update);
        editor.on("transaction", update);
        return () => {
            editor.off("selectionUpdate", update);
            editor.off("transaction", update);
        };
    }, [editor, node, getPos]);

    return active;
}

function isSelectionInside(
    editor: Editor,
    node: PMNode,
    getPos: () => number | undefined,
): boolean {
    const pos = getPos();
    if (pos === undefined) return false;
    const { from, to } = editor.state.selection;
    const end = pos + node.nodeSize;
    return from >= pos && to <= end;
}
