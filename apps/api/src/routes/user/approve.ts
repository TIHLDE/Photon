import { assignUserRole, removeUserRole } from "@photon/auth/roles";
import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    BASELINE_ROLES,
    approveUserInputSchema,
    approveUserResponseSchema,
} from "./schema";

/**
 * Approve an account someone made for themselves on the website.
 *
 * Self-registration hands out no membership: the person picks a private
 * address and a password, and until an admin says otherwise they see what any
 * visitor sees. Approving is what turns that into a member — it grants a
 * baseline role, the same pair Feide keeps in step, and with it the right to
 * read members-only pages.
 *
 * Which of the two is the admin's call, defaulting to `member`. It used to be
 * `member` flat, and that is wrong for the alumni who self-register precisely
 * because their NTNU account is gone: approving them handed out a påmeldings-
 * rett they should not have, and it had to be taken away again afterwards.
 * The role is granted inside the same transaction as the approval, so the two
 * can never disagree.
 *
 * The mail is sent last and its failure is swallowed: the approval is the
 * thing that matters, and a mail server having a bad afternoon must not roll
 * it back or make the admin think it did not take.
 *
 * There is no "unapprove". Taking membership away from someone is what
 * `PATCH /:id/status` (deactivate) and role management are for; putting an
 * account back in a queue it has already left would only be confusing.
 */
export const approveUserRoute = route().post(
    "/:id/approve",
    describeRoute({
        tags: ["users"],
        summary: "Approve a self-registered account",
        operationId: "approveUser",
        description:
            "Grants a baseline role to an account that signed itself up on the website and is waiting for approval, and tells the person by e-mail. Defaults to 'member'; pass 'alumni' for a former member, who then keeps every kind of access except registering for events. Requires 'users:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: approveUserResponseSchema,
            description: "Account approved",
        })
        .badRequest({
            description: "The account is not waiting for approval",
        })
        .notFound({ description: "User not found" })
        .unauthorized()
        .forbidden({ description: "Requires users:manage" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:manage" }),
    validator("json", approveUserInputSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const logger = c.get("logger");
        const userId = c.req.param("id");
        const approver = c.get("user");
        const role = c.req.valid("json").role ?? "member";

        const user = await db.query.user.findFirst({
            where: eq(schema.user.id, userId),
            columns: {
                id: true,
                name: true,
                email: true,
                approvalStatus: true,
            },
        });

        if (!user) {
            throw new HTTPException(404, {
                message: `User "${userId}" not found`,
            });
        }

        if (user.approvalStatus !== "pending") {
            throw new HTTPException(400, {
                message:
                    user.approvalStatus === "approved"
                        ? "Denne brukeren er allerede godkjent"
                        : "Denne brukeren venter ikke på godkjenning",
            });
        }

        await db.transaction(async (tx) => {
            const txCtx = { ...ctx, db: tx };
            await assignUserRole(txCtx, userId, role);
            // The other baseline role is cleared for the same reason
            // `baseline-role` clears it: holding both would grant what the
            // admin just chose not to. An account waiting for approval should
            // hold neither, but a Feide login can have been through here first.
            for (const other of BASELINE_ROLES) {
                if (other !== role) {
                    await removeUserRole(txCtx, userId, other);
                }
            }
            await tx
                .update(schema.user)
                .set({
                    approvalStatus: "approved",
                    approvedAt: new Date(),
                    approvedBy: approver.id,
                    updatedAt: new Date(),
                })
                .where(eq(schema.user.id, userId));
        });

        try {
            await ctx.email.sendEmailTemplate(
                {
                    from: env.MAIL_FROM,
                    to: user.email,
                    subject: "Brukeren din i TIHLDE er godkjent",
                },
                "AccountApprovedEmail",
                {
                    name: user.name,
                    loginUrl: `${env.WEBSITE_URL}/login`,
                    logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                },
            );
        } catch (error) {
            logger.error(
                { err: error, userId },
                "Failed to queue account approval email",
            );
        }

        return c.json(
            {
                message: "Account approved",
                approvalStatus: "approved" as const,
                role,
            },
            200,
        );
    },
);
