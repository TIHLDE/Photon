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
        // We validate via TanStack Form / Zod — disable browser-native validation
        // so HTML5 tooltips ("Please fill in this field") don't intercept submit.
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

/**
 * Whether the field's error message should be visible.
 *
 * The form's `validationLogic` decides *when* errors get set (blur or submit).
 * This gate decides *which* fields render their error: only the field the user
 * has interacted with, or all of them once submit has been attempted.
 */
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

/**
 * Project-wide form hook. Wraps TanStack's `useAppForm` with our defaults:
 *
 * - `validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" })`
 *   — pre-submit, validation runs on blur (so a single field's error appears
 *   when the user leaves it). After the first submit, validation runs on every
 *   change so errors update live as the user fixes things.
 * - `canSubmitWhenInvalid: true` — submit always runs validation; clicking the
 *   submit button is the way to surface every error at once.
 *
 * Either default can be overridden per-form by passing the same key.
 */
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
