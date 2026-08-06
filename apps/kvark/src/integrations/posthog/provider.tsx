import posthog from "posthog-js";
import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import type { ReactNode } from "react";

if (typeof window !== "undefined" && import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host:
            import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        person_profiles: "identified_only",
        // TanStack Router navigerer via history API, så pageviews må fanges
        // på history-endringer og ikke bare ved full sidelast.
        capture_pageview: "history_change",
        defaults: "2025-11-30",
        debug: import.meta.env.DEV,
        loaded: (ph) => {
            // Ikke send data fra lokal utvikling inn i prod-prosjektet.
            if (import.meta.env.DEV) {
                ph.opt_out_capturing();
            }
        },
    });
}

interface PostHogProviderProps {
    children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
    return (
        <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>
    );
}
