import {
    createFormHookContexts,
    createFormHook,
    useStore,
} from "@tanstack/react-form";
import { SubmitButton } from "#/components/form/SubmitButton";
import { InputField } from "#/components/form/InputField";
import { TextareaField } from "#/components/form/TextareaField";
import { NumberField } from "#/components/form/NumberField";
import { CheckboxField } from "#/components/form/CheckboxField";
import { SwitchField } from "#/components/form/SwitchField";
import { SelectField } from "#/components/form/SelectField";
import { RadioGroupField } from "#/components/form/RadioGroupField";
import { CheckboxGroupField } from "#/components/form/CheckboxGroupField";
import { ImageDropzoneField } from "#/components/form/ImageDropzoneField";
import { ComboboxField } from "#/components/form/ComboboxField";
import { FormErrors } from "#/components/form/FromErrors";

type FormAPI = {
    handleSubmit: () => void | Promise<void>;
    reset: () => void | Promise<void>;
};

export function formHandlers<TFormAPI extends FormAPI>(
    formApi: TFormAPI,
    preventDefault = true,
): React.ComponentProps<"form"> {
    return {
        onSubmit: (e) => {
            if (preventDefault) e.preventDefault();
            formApi.handleSubmit();
        },
        onReset: (e) => {
            if (preventDefault) e.preventDefault();
            formApi.reset();
        },
    };
}

export const { fieldContext, useFieldContext, formContext, useFormContext } =
    createFormHookContexts();

export function useFieldErrorVisible(): boolean {
    const field = useFieldContext();
    const submitted = useStore(
        field.form.store,
        (state) => state.submissionAttempts > 0,
    );
    return (
        (field.state.meta.isBlurred || submitted) && !field.state.meta.isValid
    );
}

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
    fieldComponents: {
        InputField,
        TextareaField,
        NumberField,
        CheckboxField,
        SwitchField,
        SelectField,
        RadioGroupField,
        CheckboxGroupField,
        ImageDropzoneField,
        ComboboxField,
    },
    formComponents: {
        SubmitButton,
        FormErrors,
    },
    fieldContext,
    formContext,
});
