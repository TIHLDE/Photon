import { useFormContext } from "#/hooks/form";
import { Button } from "@tihlde/ui/ui/button";
import { createRef, useMemo } from "react";

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
}: Omit<SubmitButtonProps, "ref">) {
    const form = useFormContext();

    const buttonRef = createRef<HTMLButtonElement>();

    const isInForm = useMemo(() => {
        return buttonRef.current?.form != null;
    }, [buttonRef]);

    return (
        <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
        >
            {([isSubmitting, canSubmit]) => (
                <Button
                    {...props}
                    type={type}
                    ref={buttonRef}
                    onClick={
                        isInForm
                            ? onClick
                            : (e) => {
                                  onClick?.(e);
                                  form.handleSubmit(e);
                              }
                    }
                    disabled={!canSubmit || isSubmitting || disabled}
                >
                    {isSubmitting ? (loading ?? children) : children}
                </Button>
            )}
        </form.Subscribe>
    );
}
