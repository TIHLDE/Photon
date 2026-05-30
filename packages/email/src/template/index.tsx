import ChangeEmailVerificationEmail from "./change-email-verification";
import CustomEmail from "./custom-email";
import FormSubmissionDeletedEmail from "./form-submission-deleted";
import FormSubmissionEmail from "./form-submission";
import NotificationMail from "./notification-mail";
import OtpSignInEmail from "./otp-sign-in";
import RegistrationBlockedEmail from "./registration-blocked";
import RegistrationConfirmedEmail from "./registration-confirmed";
import ResetPasswordEmail from "./reset-password";
import SwappedToWaitlistEmail from "./swapped-to-waitlist";
import WaitlistPlacementEmail from "./waitlist-placement";
import { ContractSignedEmail } from "./contract-signed";
import { render } from "@react-email/render";
import type { ComponentProps, ReactElement } from "react";

type EmailTemplateComponent<TProps> = (props: TProps) => ReactElement;

const EMAIL_TEMPLATES = {
    ChangeEmailVerificationEmail,
    CustomEmail,
    FormSubmissionDeletedEmail,
    FormSubmissionEmail,
    NotificationMail,
    OtpSignInEmail,
    RegistrationBlockedEmail,
    RegistrationConfirmedEmail,
    ResetPasswordEmail,
    SwappedToWaitlistEmail,
    WaitlistPlacementEmail,
    ContractSignedEmail,
} satisfies Record<string, EmailTemplateComponent<any>>;

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;
export type EmailTemplateOptions<TName extends EmailTemplateName> =
    ComponentProps<(typeof EMAIL_TEMPLATES)[TName]>;

export async function renderEmailTemplate<TName extends EmailTemplateName>(
    templateName: TName,
    options: EmailTemplateOptions<TName>,
) {
    const Template = EMAIL_TEMPLATES[templateName] as EmailTemplateComponent<
        EmailTemplateOptions<TName>
    >;

    return await render(Template(options));
}

export {
    ChangeEmailVerificationEmail,
    ContractSignedEmail,
    CustomEmail,
    FormSubmissionDeletedEmail,
    FormSubmissionEmail,
    NotificationMail,
    OtpSignInEmail,
    RegistrationBlockedEmail,
    RegistrationConfirmedEmail,
    ResetPasswordEmail,
    SwappedToWaitlistEmail,
    WaitlistPlacementEmail,
};
