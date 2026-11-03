// A browser reads a backslash as "/" and drops tabs and newlines from a URL, so
// either can turn a path that looks local into another site.
const UNSAFE_REDIRECT_CHARACTERS = /[\\\p{Cc}]/u;

/**
 * Only allow redirecting back to a path on this site. Without this, a crafted
 * `?redirectTo=https://evil.example` would bounce the user off-site after login.
 */
export function sanitizeRedirectTo(url: unknown): string {
    if (typeof url !== "string") return "/";
    // Reject protocol-relative ("//evil.com") and absolute URLs.
    if (!url.startsWith("/") || url.startsWith("//")) return "/";
    if (UNSAFE_REDIRECT_CHARACTERS.test(url)) return "/";
    return url;
}
