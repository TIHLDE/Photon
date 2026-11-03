import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { Ref } from "react";

import { useTheme } from "#/integrations/theme";
import { TURNSTILE_SITE_KEY } from "#/lib/turnstile";

type TurnstileChallengeProps = {
    /**
     * Which form this widget belongs to. The server demands the matching
     * action per endpoint, so a token solved here only works there.
     */
    action: string;
    /** Lets the form reset the widget — a token is spent once checked. */
    turnstileRef?: Ref<TurnstileInstance | undefined>;
    /** A fresh token, or `undefined` once it expires or the widget fails. */
    onToken: (token: string | undefined) => void;
};

/**
 * The Cloudflare Turnstile widget, in production builds only — the API only
 * demands a challenge there, so dev renders nothing.
 */
export function TurnstileChallenge({
    action,
    turnstileRef,
    onToken,
}: TurnstileChallengeProps) {
    const { theme, mounted } = useTheme();

    // Waits for `mounted`: before that `theme` is a placeholder, not the one
    // the page is shown in.
    if (!TURNSTILE_SITE_KEY || !mounted) return null;

    return (
        <Turnstile
            // The widget reads its theme once, so a theme switch has to
            // render a new one.
            key={theme}
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            options={{
                action,
                size: "flexible",
                theme,
                language: "nb",
            }}
            onSuccess={onToken}
            onExpire={() => onToken(undefined)}
            onError={() => onToken(undefined)}
        />
    );
}
