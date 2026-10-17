import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { env } from "~/lib/env";
import { HTTPAppException } from "~/lib/errors";
import { getGroup, isGroupMember, isOpenForJoinRequests } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { joinRequestResponseSchema } from "./schema";

const ONE_DAY_SECONDS = 24 * 60 * 60;

export const joinRequestRoute = route().post(
    "/:slug/join-request",
    describeRoute({
        tags: ["groups"],
        summary: "Ask an interest group's leaders to add you",
        operationId: "requestToJoinGroup",
        description:
            "Emails the group's leaders that the caller wants to join. At most once a day per member and group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: joinRequestResponseSchema,
            description: "Email sent to the leaders",
        })
        .badRequest({ description: "The group does not take join requests" })
        .notFound({ description: "Group not found" })
        .response({ statusCode: 409, description: "Already a member" })
        .response({
            statusCode: 429,
            description: "Already asked within the last day",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const slug = c.req.param("slug");

        const group = await getGroup(ctx, slug);
        if (!group) throw HTTPAppException.NotFound("Group");
        if (!isOpenForJoinRequests(group)) {
            throw HTTPAppException.BadRequest(
                "Gruppen tar ikke imot nye medlemmer akkurat nå.",
            );
        }
        if (await isGroupMember(ctx, user.id, slug)) {
            throw HTTPAppException.Conflict(
                "Du er allerede medlem av gruppen.",
            );
        }

        const key = `group-join-request:${slug}:${user.id}`;
        if (await ctx.cache.getString(key)) {
            throw new HTTPAppException({
                status: 429,
                message:
                    "Du har allerede bedt gruppelederen om å legge deg til.",
            });
        }

        const leaders = await ctx.db
            .select({ email: schema.user.email })
            .from(schema.groupMembership)
            .innerJoin(
                schema.user,
                eq(schema.user.id, schema.groupMembership.userId),
            )
            .where(
                and(
                    eq(schema.groupMembership.groupSlug, slug),
                    eq(schema.groupMembership.role, "leader"),
                ),
            );

        const subject = `Ønsker å bli med i ${group.name}`;
        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: leaders.map((leader) => leader.email),
                subject,
            },
            "NotificationMail",
            {
                title: subject,
                description: `${user.name} vil gjerne bli med i interessegruppen ${group.name}, gjerne legg dem til som medlem!`,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );

        await ctx.cache.setString(key, "1", ONE_DAY_SECONDS);

        return c.json(
            { message: "Gruppeleder har blitt bedt om å legge deg til!" },
            200,
        );
    },
);
