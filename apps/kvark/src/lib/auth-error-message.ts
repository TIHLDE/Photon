/**
 * Norwegian text for the errors Better Auth answers with.
 *
 * Better Auth ships its messages in English ("Invalid username or password"),
 * and those went straight into the red line under the login form. Everything
 * else on that page is Norwegian, so the one moment something goes wrong was
 * also the one moment the site switched language.
 *
 * Our own backend already throws Norwegian messages (`APIError` in
 * @photon/auth), and those carry no `code` — so an unknown code with a message
 * is passed through untouched, and only Better Auth's own vocabulary is
 * replaced.
 */

export type AuthErrorLike = {
    message?: string;
    code?: string;
    status?: number;
};

const GENERIC = "Noe gikk galt. Prøv igjen.";

/**
 * Keyed on Better Auth's error codes (`BASE_ERROR_CODES` plus the username
 * plugin's). Anything reachable from login, registration, password reset or
 * Feide-linking is here; the rest fall back to {@link GENERIC}.
 */
const MESSAGES: Record<string, string> = {
    // Sign in
    INVALID_USERNAME_OR_PASSWORD: "Feil brukernavn eller passord.",
    INVALID_EMAIL_OR_PASSWORD: "Feil e-post eller passord.",
    INVALID_PHONE_NUMBER_OR_PASSWORD: "Feil telefonnummer eller passord.",
    INVALID_PASSWORD: "Feil passord.",
    INVALID_EMAIL: "E-postadressen er ikke gyldig.",
    INVALID_USERNAME: "Brukernavnet er ikke gyldig.",
    INVALID_DISPLAY_USERNAME: "Brukernavnet er ikke gyldig.",
    INVALID_USER: "Vi fant ingen bruker.",
    USER_NOT_FOUND: "Vi fant ingen bruker med dette brukernavnet.",
    EMAIL_NOT_VERIFIED: "Du må bekrefte e-posten din før du kan logge inn.",
    CREDENTIAL_ACCOUNT_NOT_FOUND:
        "Denne brukeren har ikke passord. Logg inn med Feide.",
    ACCOUNT_NOT_FOUND: "Vi fant ingen bruker.",
    BANNED_USER: "Brukeren din er sperret. Ta kontakt med Index.",
    TOO_MANY_ATTEMPTS: "For mange forsøk. Vent litt og prøv igjen.",
    ACCOUNT_TEMPORARILY_LOCKED:
        "For mange forsøk. Brukeren er låst en liten stund. Prøv igjen senere.",

    // Passord
    PASSWORD_TOO_SHORT: "Passordet er for kort. Bruk minst 8 tegn.",
    PASSWORD_TOO_LONG: "Passordet er for langt.",
    PASSWORD_COMPROMISED:
        "Dette passordet har lekket på nett. Velg et annet passord.",
    PASSWORD_ALREADY_SET: "Du har allerede satt et passord.",
    USER_ALREADY_HAS_PASSWORD: "Du har allerede satt et passord.",

    // Registrering
    USER_ALREADY_EXISTS: "Det finnes allerede en bruker med denne e-posten.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
        "Det finnes allerede en bruker med denne e-posten. Bruk en annen.",
    USERNAME_IS_ALREADY_TAKEN: "Brukernavnet er opptatt. Velg et annet.",
    USERNAME_TOO_SHORT: "Brukernavnet er for kort.",
    USERNAME_TOO_LONG: "Brukernavnet er for langt.",
    FAILED_TO_CREATE_USER: "Vi fikk ikke opprettet brukeren. Prøv igjen.",

    // Lenker i e-post
    INVALID_TOKEN: "Lenken virker ikke. Be om en ny.",
    TOKEN_EXPIRED: "Lenken har gått ut. Be om en ny.",
    EMAIL_ALREADY_VERIFIED: "E-posten er allerede bekreftet. Du kan logge inn.",
    VERIFICATION_EMAIL_NOT_ENABLED: GENERIC,
    FAILED_TO_CREATE_VERIFICATION: "Vi fikk ikke sendt lenken. Prøv igjen.",
    USER_EMAIL_NOT_FOUND: "Vi fant ingen bruker med denne e-posten.",
    EMAIL_MISMATCH: "E-posten stemmer ikke med brukeren.",

    // Sesjon
    SESSION_EXPIRED: "Du har blitt logget ut. Logg inn på nytt.",
    SESSION_NOT_FRESH: "Logg inn på nytt for å gjøre dette.",
    FAILED_TO_CREATE_SESSION: "Vi fikk ikke logget deg inn. Prøv igjen.",
    FAILED_TO_GET_SESSION: "Vi fikk ikke sjekket innloggingen din. Prøv igjen.",
    COULD_NOT_CREATE_SESSION: "Vi fikk ikke logget deg inn. Prøv igjen.",
    FAILED_TO_UPDATE_USER: "Vi fikk ikke lagret endringen. Prøv igjen.",

    // Feide
    SOCIAL_ACCOUNT_ALREADY_LINKED:
        "Denne Feide-brukeren er allerede koblet til en annen bruker.",
    LINKED_ACCOUNT_ALREADY_EXISTS:
        "Denne Feide-brukeren er allerede koblet til en annen bruker.",
    ACCOUNT_NOT_LINKED: "Feide er ikke koblet til brukeren din ennå.",
    PROVIDER_NOT_FOUND: "Feide-innlogging er ikke tilgjengelig nå.",
    FAILED_TO_UNLINK_LAST_ACCOUNT:
        "Du kan ikke koble fra den siste måten du logger inn på.",
    FAILED_TO_GET_USER_INFO: "Vi fikk ikke hentet informasjon fra Feide.",
    ID_TOKEN_NOT_SUPPORTED: GENERIC,
    INVALID_OAUTH_CONFIG: GENERIC,
    INVALID_OAUTH_CONFIGURATION: GENERIC,

    // Sikkerhet og validering
    INVALID_ORIGIN: "Innloggingen ble stoppet. Prøv igjen fra tihlde.org.",
    CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
        "Innloggingen ble stoppet. Prøv igjen fra tihlde.org.",
    INVALID_CALLBACK_URL: GENERIC,
    INVALID_REDIRECT_URL: GENERIC,
    INVALID_ERROR_CALLBACK_URL: GENERIC,
    INVALID_NEW_USER_CALLBACK_URL: GENERIC,
    VALIDATION_ERROR: "Sjekk at alt er fylt ut riktig.",
    MISSING_FIELD: "Du må fylle ut alle feltene.",
    UNKNOWN_ERROR: GENERIC,
    UNEXPECTED_ERROR: GENERIC,
    INTERNAL_SERVER_ERROR: GENERIC,
};

/**
 * The same lookup keyed on Better Auth's English text, for the responses that
 * carry a message but no code.
 */
const BY_ENGLISH_MESSAGE: Record<string, string> = {
    "invalid username or password": MESSAGES.INVALID_USERNAME_OR_PASSWORD,
    "invalid email or password": MESSAGES.INVALID_EMAIL_OR_PASSWORD,
    "invalid password": MESSAGES.INVALID_PASSWORD,
    "user not found": MESSAGES.USER_NOT_FOUND,
    "email not verified": MESSAGES.EMAIL_NOT_VERIFIED,
    "user already exists.": MESSAGES.USER_ALREADY_EXISTS,
    "username is already taken. please try another.":
        MESSAGES.USERNAME_IS_ALREADY_TAKEN,
    "invalid token": MESSAGES.INVALID_TOKEN,
    "token expired": MESSAGES.TOKEN_EXPIRED,
    "password too short": MESSAGES.PASSWORD_TOO_SHORT,
    "password too long": MESSAGES.PASSWORD_TOO_LONG,
    "credential account not found": MESSAGES.CREDENTIAL_ACCOUNT_NOT_FOUND,
    "social account already linked": MESSAGES.SOCIAL_ACCOUNT_ALREADY_LINKED,
    "something went wrong": GENERIC,
    "unexpected error": GENERIC,
};

/**
 * Norwegian text for an error from the auth client.
 *
 * `fallback` is what to say when the error carries neither a known code nor a
 * message of its own — pass something that fits the action being attempted.
 */
export function authErrorMessage(
    error: AuthErrorLike | undefined | null,
    fallback: string = GENERIC,
): string {
    const code = error?.code?.trim().toUpperCase();
    if (code && code in MESSAGES) return MESSAGES[code];

    const message = error?.message?.trim();
    if (message) {
        const known = BY_ENGLISH_MESSAGE[message.toLowerCase()];
        if (known) return known;
        // Our own backend's messages land here, and they are already Norwegian.
        return message;
    }

    if (error?.status === 429) {
        return "For mange forsøk. Vent litt og prøv igjen.";
    }

    return fallback;
}

/**
 * Norwegian text for the `?error=` slug a failed Feide callback sends back to
 * the login page. Better Auth builds these from its own error codes, so they
 * arrive lowercased with underscores.
 *
 * `signup_disabled` and `account_not_linked` are deliberately absent: those two
 * mean "we could not decide which account is yours", and the login page answers
 * them with `FeideSignInIssue` rather than a message.
 */
const FEIDE_CALLBACK_MESSAGES: Record<string, string> = {
    access_denied: "Du avbrøt innloggingen i Feide.",
    state_not_found: "Innloggingen tok for lang tid. Prøv igjen.",
    state_mismatch: "Innloggingen tok for lang tid. Prøv igjen.",
    state_security_mismatch: "Innloggingen tok for lang tid. Prøv igjen.",
    invalid_callback_request: "Innloggingen ble avbrutt. Prøv igjen.",
    no_callback_url: "Innloggingen ble avbrutt. Prøv igjen.",
    no_code: "Innloggingen ble avbrutt. Prøv igjen.",
    invalid_code: "Innloggingen ble avbrutt. Prøv igjen.",
    email_not_found:
        "Feide sendte oss ingen e-postadresse. Ta kontakt med Index.",
    "email_doesn't_match": "E-posten fra Feide passer ikke med brukeren din.",
    account_already_linked_to_different_user:
        "Denne Feide-brukeren er allerede koblet til en annen bruker.",
    unable_to_link_account: "Vi fikk ikke koblet Feide til brukeren din.",
    unable_to_get_user_info: "Vi fikk ikke hentet informasjon fra Feide.",
    oauth_provider_not_found: "Feide-innlogging er ikke tilgjengelig nå.",
    internal_server_error: "Noe gikk galt hos oss. Prøv igjen.",
};

export function feideCallbackErrorMessage(slug: string): string {
    return (
        FEIDE_CALLBACK_MESSAGES[slug.trim().toLowerCase()] ??
        "Innloggingen med Feide gikk ikke gjennom. Prøv igjen."
    );
}
