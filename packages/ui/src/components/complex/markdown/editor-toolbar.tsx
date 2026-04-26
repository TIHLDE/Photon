import { type Editor, useEditorState } from "@tiptap/react";
import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Plus,
    Quote,
    Redo2,
    SquareCode,
    Strikethrough,
    Undo2,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Separator } from "#/components/ui/separator";
import { Toggle } from "#/components/ui/toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "#/components/ui/tooltip";

import type { DirectiveRegistry } from "./directive";

export type EditorToolbarProps = {
    editor: Editor | null;
    registry: DirectiveRegistry;
};

type ToolbarState = {
    isBold: boolean;
    isItalic: boolean;
    isStrike: boolean;
    isCode: boolean;
    isH1: boolean;
    isH2: boolean;
    isH3: boolean;
    isBulletList: boolean;
    isOrderedList: boolean;
    isBlockquote: boolean;
    isCodeBlock: boolean;
    isLink: boolean;
    canUndo: boolean;
    canRedo: boolean;
};

const FALLBACK_STATE: ToolbarState = {
    isBold: false,
    isItalic: false,
    isStrike: false,
    isCode: false,
    isH1: false,
    isH2: false,
    isH3: false,
    isBulletList: false,
    isOrderedList: false,
    isBlockquote: false,
    isCodeBlock: false,
    isLink: false,
    canUndo: false,
    canRedo: false,
};

export function EditorToolbar({ editor, registry }: EditorToolbarProps) {
    const state =
        useEditorState({
            editor,
            selector: ({ editor: instance }): ToolbarState => {
                if (!instance) return FALLBACK_STATE;
                return {
                    isBold: instance.isActive("bold"),
                    isItalic: instance.isActive("italic"),
                    isStrike: instance.isActive("strike"),
                    isCode: instance.isActive("code"),
                    isH1: instance.isActive("heading", { level: 1 }),
                    isH2: instance.isActive("heading", { level: 2 }),
                    isH3: instance.isActive("heading", { level: 3 }),
                    isBulletList: instance.isActive("bulletList"),
                    isOrderedList: instance.isActive("orderedList"),
                    isBlockquote: instance.isActive("blockquote"),
                    isCodeBlock: instance.isActive("codeBlock"),
                    isLink: instance.isActive("link"),
                    canUndo: instance.can().undo(),
                    canRedo: instance.can().redo(),
                };
            },
        }) ?? FALLBACK_STATE;

    if (!editor) return null;

    return (
        <div className="flex flex-wrap items-center gap-1 p-1">
            <ToolGroup>
                <IconToggle
                    label="Bold"
                    pressed={state.isBold}
                    onPressedChange={() =>
                        editor.chain().focus().toggleBold().run()
                    }
                >
                    <Bold className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Italic"
                    pressed={state.isItalic}
                    onPressedChange={() =>
                        editor.chain().focus().toggleItalic().run()
                    }
                >
                    <Italic className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Strikethrough"
                    pressed={state.isStrike}
                    onPressedChange={() =>
                        editor.chain().focus().toggleStrike().run()
                    }
                >
                    <Strikethrough className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Inline code"
                    pressed={state.isCode}
                    onPressedChange={() =>
                        editor.chain().focus().toggleCode().run()
                    }
                >
                    <Code className="size-4" />
                </IconToggle>
            </ToolGroup>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolGroup>
                <IconToggle
                    label="Heading 1"
                    pressed={state.isH1}
                    onPressedChange={() =>
                        editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                >
                    <Heading1 className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Heading 2"
                    pressed={state.isH2}
                    onPressedChange={() =>
                        editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                >
                    <Heading2 className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Heading 3"
                    pressed={state.isH3}
                    onPressedChange={() =>
                        editor.chain().focus().toggleHeading({ level: 3 }).run()
                    }
                >
                    <Heading3 className="size-4" />
                </IconToggle>
            </ToolGroup>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolGroup>
                <IconToggle
                    label="Bullet list"
                    pressed={state.isBulletList}
                    onPressedChange={() =>
                        editor.chain().focus().toggleBulletList().run()
                    }
                >
                    <List className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Numbered list"
                    pressed={state.isOrderedList}
                    onPressedChange={() =>
                        editor.chain().focus().toggleOrderedList().run()
                    }
                >
                    <ListOrdered className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Blockquote"
                    pressed={state.isBlockquote}
                    onPressedChange={() =>
                        editor.chain().focus().toggleBlockquote().run()
                    }
                >
                    <Quote className="size-4" />
                </IconToggle>
                <IconToggle
                    label="Code block"
                    pressed={state.isCodeBlock}
                    onPressedChange={() =>
                        editor.chain().focus().toggleCodeBlock().run()
                    }
                >
                    <SquareCode className="size-4" />
                </IconToggle>
            </ToolGroup>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => promptForLink(editor)}
                            aria-pressed={state.isLink}
                        >
                            <LinkIcon className="size-4" />
                        </Button>
                    }
                />
                <TooltipContent>Link</TooltipContent>
            </Tooltip>

            {registry.directives.length > 0 ? (
                <>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <DirectiveInsertMenu editor={editor} registry={registry} />
                </>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!state.canUndo}
                                onClick={() =>
                                    editor.chain().focus().undo().run()
                                }
                            >
                                <Undo2 className="size-4" />
                            </Button>
                        }
                    />
                    <TooltipContent>Undo</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!state.canRedo}
                                onClick={() =>
                                    editor.chain().focus().redo().run()
                                }
                            >
                                <Redo2 className="size-4" />
                            </Button>
                        }
                    />
                    <TooltipContent>Redo</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

function ToolGroup({ children }: { children: ReactNode }) {
    return <div className="flex items-center gap-0.5">{children}</div>;
}

function IconToggle({
    label,
    pressed,
    onPressedChange,
    children,
}: {
    label: string;
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Toggle
                        size="sm"
                        pressed={pressed}
                        onPressedChange={onPressedChange}
                        aria-label={label}
                    >
                        {children}
                    </Toggle>
                }
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function DirectiveInsertMenu({
    editor,
    registry,
}: {
    editor: Editor;
    registry: DirectiveRegistry;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button type="button" variant="ghost" size="sm">
                        <Plus className="size-4" />
                        <span>Insert</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="start">
                {registry.directives.map((directive) => (
                    <DropdownMenuItem
                        key={directive.name}
                        onClick={() => insertDirective(editor, directive.name)}
                    >
                        {directive.icon ? (
                            <span className="mr-2 inline-flex size-4 items-center justify-center">
                                {directive.icon}
                            </span>
                        ) : null}
                        {directive.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function insertDirective(editor: Editor, name: string): void {
    const directiveType = `directive-${name}`;
    if (!editor.schema.nodes[directiveType]) {
        return;
    }
    editor
        .chain()
        .focus()
        .insertContent({ type: directiveType, attrs: {} })
        .run();
}

function promptForLink(editor: Editor): void {
    const previous = editor.getAttributes("link")?.["href"];
    const url =
        typeof window !== "undefined"
            ? window.prompt("URL", previous ?? "")
            : null;
    if (url === null) return;
    if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}
