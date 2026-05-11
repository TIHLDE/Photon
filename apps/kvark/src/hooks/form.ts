import {
    createFormHookContexts,
    createFormHook,
    revalidateLogic,
    useStore,
} from "@tanstack/react-form";
import {
    Checkbox,
    CheckboxGroup,
    Combobox,
    DatePicker,
    DateRangePicker,
    Description,
    Error,
    Field,
    ImageDropzone,
    Input,
    Label,
    Number,
    Password,
    RadioGroup,
    Select,
    Switch,
    Textarea,
    TimePicker,
} from "#/components/form/field";
import { FormErrors } from "#/components/form/form-errors";
import { SubmitButton } from "#/components/form/submit-button";

type FormAPI = {
    handleSubmit: () => void | Promise<void>;
    reset: () => void | Promise<void>;
};

export function formHandlers<TFormAPI extends FormAPI>(
    formApi: TFormAPI,
    preventDefault = true,
): React.ComponentProps<"form"> {
    return {
        noValidate: true,
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

const {
    useAppForm: useAppFormBase,
    withForm,
    withFieldGroup,
} = createFormHook({
    fieldComponents: {
        Field,
        Label,
        Input,
        Password,
        Textarea,
        Number,
        Checkbox,
        CheckboxGroup,
        Switch,
        Select,
        RadioGroup,
        Combobox,
        DatePicker,
        DateRangePicker,
        TimePicker,
        ImageDropzone,
        Description,
        Error,
    },
    formComponents: {
        SubmitButton,
        FormErrors,
    },
    fieldContext,
    formContext,
});

export const useAppForm = ((opts) => {
    return useAppFormBase({
        validationLogic: revalidateLogic({
            mode: "blur",
            modeAfterSubmission: "change",
        }),
        canSubmitWhenInvalid: true,
        ...opts,
    });
}) as typeof useAppFormBase;

export { withForm, withFieldGroup };
