import { schema } from "@photon/db";
import {
    applicationBudgetTypeVariants,
    applicationCaseTypeVariants,
} from "@photon/db/schema";
import { asc } from "drizzle-orm";
import {
    financeEmailForGroup,
    isSelectableGroupType,
} from "~/lib/application/groups";
import {
    applicationBudgetTypeLabels,
    applicationCaseTypeLabels,
} from "~/lib/application/labels";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { applicationOptionsSchema } from "./schema";

/**
 * The dropdown contents for the søknad forms.
 *
 * The old portal hardcoded 40 group names and 38 økonomiansvarlig addresses in
 * the client. Groups now come from org_group and the addresses follow from
 * TIHLDE's `okonomiansvarlig.<slug>@tihlde.org` convention, so adding an
 * interessegruppe needs no code change at all.
 */
export const optionsRoute = route().get(
    "/options",
    describeRoute({
        tags: ["applications"],
        summary: "Get application form options",
        operationId: "getApplicationOptions",
        description:
            "Groups selectable in the application forms, their økonomiansvarlig addresses, and the budget/case type labels.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: applicationOptionsSchema,
            description: "Form options",
        })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");

        const groups = await db
            .select({
                slug: schema.group.slug,
                name: schema.group.name,
                type: schema.group.type,
            })
            .from(schema.group)
            .orderBy(asc(schema.group.name));

        const selectable = groups
            .filter((group) => isSelectableGroupType(group.type))
            .map(({ slug, name }) => ({ slug, name }));

        return c.json(
            {
                groups: selectable,
                ccOptions: selectable.map((group) => ({
                    ...group,
                    email: financeEmailForGroup(group.slug),
                })),
                budgetTypes: applicationBudgetTypeVariants.map((value) => ({
                    value,
                    label: applicationBudgetTypeLabels[value],
                })),
                caseTypes: applicationCaseTypeVariants.map((value) => ({
                    value,
                    label: applicationCaseTypeLabels[value],
                })),
            },
            200,
        );
    },
);
