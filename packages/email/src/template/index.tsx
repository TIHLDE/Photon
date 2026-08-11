import AccountApprovedEmail from "./account-approved";
import AccountLinkHelpEmail from "./account-link-help";
import ApplicationDecidedEmail from "./application-decided";
import ApplicationReceiptEmail from "./application-receipt";
import ApplicationSubmittedEmail from "./application-submitted";
import ChangeEmailVerificationEmail from "./change-email-verification";
import CompanyContactEmail from "./company-contact";
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
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactElement } from "react";

type EmailTemplateComponent<TProps> = (props: TProps) => ReactElement;

const EMAIL_TEMPLATES = {
    AccountApprovedEmail,
    AccountLinkHelpEmail,
    ApplicationDecidedEmail,
    ApplicationReceiptEmail,
    ApplicationSubmittedEmail,
    ChangeEmailVerificationEmail,
    CompanyContactEmail,
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

    // @react-email/render resolves react-dom/server through a dynamic import
    // and reads `.default` off the module namespace. Under Bun that interop is
    // unreliable (react-dom's server.bun.js build has no dependable default
    // export), which made every email render throw
    // "undefined is not an object (evaluating 'Object.hasOwn(reactDOMServer, ...)')"
    // in production. None of our templates suspend, so render synchronously via
    // the named export instead and prepend the doctype ourselves (same one
    // @react-email/render emits).
    const markup = renderToStaticMarkup(Template(options));
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${markup}`;
}

export {
    AccountApprovedEmail,
    AccountLinkHelpEmail,
    ApplicationDecidedEmail,
    ApplicationReceiptEmail,
    ApplicationSubmittedEmail,
    ChangeEmailVerificationEmail,
    CompanyContactEmail,
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
