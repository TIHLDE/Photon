import {
    RichEditor,
    type DirectiveRegistry,
} from "@tihlde/ui/complex/markdown";

import { richRegistry } from "#/components/markdown/directives/presets";
import { useFieldContext } from "#/hooks/form";
import { useField } from "./field";

interface MarkdownProps {
    /** Hvilke direktiver som kan brukes. Full pakke som standard. */
    registry?: DirectiveRegistry;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
}

/**
 * Markdown-editor for tekstfelt som rendres som markdown senere. Bruk denne i
 * stedet for `field.Textarea` når innholdet vises med `MarkdownView`.
 */
export function Markdown({ registry = richRegistry, ...props }: MarkdownProps) {
    const field = useFieldContext<string>();
    const ctx = useField();

    return (
        <RichEditor
            {...props}
            registry={registry}
            value={field.state.value}
            onChange={field.handleChange}
            ariaLabelledBy={`${ctx.inputId}-label`}
        />
    );
}
