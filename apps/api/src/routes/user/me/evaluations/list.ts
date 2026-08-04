import { getUnansweredEvaluations } from "~/lib/form/evaluation";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { unansweredEvaluationsSchema } from "../../schema";

/**
 * The evaluations the member still owes an answer to.
 *
 * Drives the "Spørreskjemaer" tab on the profile, and is the same list the
 * registration route refuses new sign-ups over — so the member can see exactly
 * what is in their way rather than only meeting it as an error.
 */
export const listUnansweredEvaluationsRoute = route().get(
    "/unanswered-evaluations",
    describeRoute({
        tags: ["users", "forms"],
        summary: "List the member's unanswered evaluations",
        operationId: "listUnansweredEvaluations",
        description:
            "Evaluation forms for events the member attended but never answered. These block registration for new events.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: unansweredEvaluationsSchema,
            description: "Unanswered evaluations, newest event first",
        })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const userId = c.get("user").id;

        return c.json(await getUnansweredEvaluations(ctx, userId), 200);
    },
);
