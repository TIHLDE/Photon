/**
 * Cloudflare Turnstile site key, in production builds only — the API only
 * demands a challenge in production, so dev never shows the widget. Public by
 * design (it ends up in the page anyway), hence the default.
 */
export const TURNSTILE_SITE_KEY = import.meta.env.PROD
    ? (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
      "0x4AAAAAAFrmg_CDIed3oFw3"
    : undefined;

/**
 * The `action` the sign-up widget is rendered with. Must match
 * `TURNSTILE_SIGN_UP_ACTION` in @photon/auth, which the server demands.
 */
export const TURNSTILE_SIGN_UP_ACTION = "signup";
