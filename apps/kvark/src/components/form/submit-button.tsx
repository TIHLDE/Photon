import { useFormContext } from "#/hooks/form";
import { Button } from "@tihlde/ui/ui/button";
import { useRef } from "react";

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
    disabled?: boolean;
    loading?: React.ReactNode;
}

export function SubmitButton({
    type = "submit",
    disabled,
    loading,
    onClick,
    children,
    ...props
}: SubmitButtonProps) {
    const form = useFormContext();
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
                <Button
                    {...props}
                    ref={buttonRef}
                    type={type}
                    onClick={(e) => {
                        onClick?.(e);
                        if (e.defaultPrevented) return;
                        // Standalone (not inside a <form>) — native submit can't fire, so trigger manually.
                        if (!buttonRef.current?.form) {
                            form.handleSubmit();
                        }
                    }}
                    disabled={isSubmitting || disabled}
                >
                    {isSubmitting ? (loading ?? children) : children}
                </Button>
            )}
        </form.Subscribe>
    );
}
