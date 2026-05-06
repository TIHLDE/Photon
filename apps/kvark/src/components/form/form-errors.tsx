import { useFormContext } from "#/hooks/form";
import { FieldError } from "@tihlde/ui/ui/field";

export function FormErrors(
    props: Omit<React.ComponentProps<typeof FieldError>, "errors">,
) {
    const form = useFormContext();

    return (
        <form.Subscribe selector={(state) => state.errors}>
            {(errors) => <FieldError {...props} errors={errors} />}
        </form.Subscribe>
    );
}
