import type {
    AuthContext,
    MiddlewareContext,
    MiddlewareOptions,
} from "better-auth";
import type { AuthCreateContext } from "./index";

const LEGACY_TOKEN_COOKIE_NAME = "LEPTON_LEGACY_TOKEN";

/**
 * Runs Feide tasks AFTER each auth request, to ensure synced info
 *
 * Important to note that this should run in the BetterAuth "after" hook
 * @param middlewareContext Middleware context
 */
export const syncLegacyTokenHook: (
    middlewareCtx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
            returned?: unknown;
            responseHeaders?: Headers;
        }
    >,
    ctx: AuthCreateContext,
) => Promise<void> = async (middlewareContext, ctx) => {
    const session =
        middlewareContext.context.newSession ??
        middlewareContext.context.session;

    const legacyToken = session?.user.legacyToken;

    middlewareContext.setCookie(LEGACY_TOKEN_COOKIE_NAME, legacyToken ?? "");
};
