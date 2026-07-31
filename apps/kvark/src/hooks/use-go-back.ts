import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * En tilbake-knapp som faktisk går tilbake.
 *
 * Sider man kommer til fra flere steder — et spørreskjema nås både fra
 * profilen, en e-post og en gruppeside — pleide å ha en hardkodet lenke hjem,
 * som sendte deg et helt annet sted enn der du kom fra. Går til `fallback`
 * bare når det ikke finnes noe å gå tilbake til (åpnet i ny fane, eller
 * direkte fra en e-postlenke).
 */
export function useGoBack(fallback: string = "/"): () => void {
    const router = useRouter();
    const canGoBack = useCanGoBack();
    const navigate = useNavigate();

    return useCallback(() => {
        if (canGoBack) {
            router.history.back();
            return;
        }
        navigate({ to: fallback });
    }, [canGoBack, router, navigate, fallback]);
}
