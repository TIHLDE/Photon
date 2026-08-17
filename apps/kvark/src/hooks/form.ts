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
    DateTimePicker,
    Description,
    Error,
    Field,
    ImageDropzone,
    Input,
    Label,
    Markdown,
    Number,
    Password,
    RadioGroup,
    Select,
    Switch,
    Textarea,
    TimePicker,
} from "#/components/form/field";
import { InputField, PasswordField } from "#/components/form/basic-fields";
import { FormErrors } from "#/components/form/form-errors";
import { SubmitButton } from "#/components/form/submit-button";

type FormAPI = {
    handleSubmit: () => void | Promise<void>;
    reset: () => void | Promise<void>;
};

/**
 * Bring the first field that failed validation into view.
 *
 * Long forms put the submit button far below the fields it validates, so a
 * rejected submit otherwise looks like the button did nothing at all — the
 * error message renders off-screen.
 */
function revealFirstInvalidField(formEl: HTMLFormElement) {
    const field = formEl.querySelector<HTMLElement>(
        '[data-invalid="true"], [data-invalid=""]',
    );
    if (!field) return;

    field.scrollIntoView({ behavior: "smooth", block: "center" });

    // Only text-like controls are focused: focusing a select or combobox
    // trigger risks reopening its popup right under the user's cursor.
    field
        .querySelector<HTMLElement>("input:not([type=hidden]), textarea")
        ?.focus({ preventScroll: true });
}

export function formHandlers<TFormAPI extends FormAPI>(
    formApi: TFormAPI,
    preventDefault = true,
): React.ComponentProps<"form"> {
    return {
        noValidate: true,
        onSubmit: (e) => {
            if (preventDefault) e.preventDefault();
            // `currentTarget` is nulled once the handler returns, so keep the
            // element before awaiting the submit.
            const formEl = e.currentTarget;
            void Promise.resolve(formApi.handleSubmit()).then(() =>
                revealFirstInvalidField(formEl),
            );
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
        InputField,
        PasswordField,
        Password,
        Textarea,
        Markdown,
        Number,
        Checkbox,
        CheckboxGroup,
        Switch,
        Select,
        RadioGroup,
        Combobox,
        DatePicker,
        DateRangePicker,
        DateTimePicker,
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
