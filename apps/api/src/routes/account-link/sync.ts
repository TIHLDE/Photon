import { NoFeideAccountError, syncFeideForUser } from "@photon/auth/feide";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { accountLinkSyncResponseSchema } from "./schema";

/**
 * Finish an account link by pulling the member's study data from Feide.
 *
 * Linking cannot do this itself. Better Auth's `/oauth2/callback` has two
 * branches, and the link branch writes the account row and redirects without
 * ever calling `setSessionCookie` — the member was already signed in, so no
 * new session is minted. `syncFeideHook` keys on that new session to learn who
 * logged in, so for a link it has nobody to sync and returns early.
 *
 * The result in production on 2026-07-30: five members linked Feide and kept a
 * complete-looking account with no study programme, campus or cohort. Nothing
 * was lost — the next Feide sign-in fills it in — but until then they sit
 * outside every priority pool that selects on a study or cohort group, and
 * they have no way to know.
 *
 * So the page they land on afterwards calls this instead. It has the session
 * the callback lacked, which is all that was ever missing.
 *
 * Idempotent: the underlying writes are additive and conflict-tolerant, so a
 * member may call it as often as they like. That also makes it the repair tool
 * for the five already in this state.
 */
export const accountLinkSyncRoute = route().post(
    "/sync",
    describeRoute({
        tags: ["account-link"],
        summary: "Sync study data from Feide for the current user",
        operationId: "syncFeideAccount",
        description:
            "Reads the caller's study programmes, cohort and campus from Feide and applies them, including derived study groups and the member/alumni role. Run after linking a Feide account, which cannot sync on its own. Safe to repeat.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: accountLinkSyncResponseSchema,
            description: "Study data synced",
        })
        .response({
            statusCode: 409,
            description: "No Feide account is linked to this user",
        })
        .response({
            statusCode: 502,
            description: "Feide could not be reached",
        })
        .build(),
    requireAuth,
    async (c) => {
        const user = c.get("user");
        const { db } = c.get("ctx");
        const logger = c.get("logger");

        try {
            await syncFeideForUser(db, user.id);
        } catch (error) {
            if (error instanceof NoFeideAccountError) {
                throw new HTTPException(409, {
                    message: "Ingen Feide-konto er koblet til denne brukeren.",
                });
            }

            /**
             * Never fatal to the member: the link itself already succeeded and
             * they are signed in. Their study data is filled in by the next
             * Feide sign-in, so the caller is expected to say so and move on
             * rather than trap them here.
             */
            logger.error(
                { err: error, userId: user.id },
                "Feide sync failed after account link",
            );
            throw new HTTPException(502, {
                message:
                    "Fikk ikke hentet studieopplysningene fra Feide. De hentes neste gang du logger inn.",
            });
        }

        return c.json({ success: true }, 200);
    },
);
