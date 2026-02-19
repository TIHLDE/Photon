import { schema } from "@photon/db";
import type { TestUtilContext } from ".";

export const createCreateTestGroup =
    (ctx: TestUtilContext) =>
    async (options?: {
        slug?: string;
        name?: string;
        type?: string;
        description?: string;
        finesActivated?: boolean;
        finesAdminId?: string;
    }) => {
        const slug = options?.slug ?? `test-group-${Date.now()}`;
        const name = options?.name ?? "Test Group";
        const type = options?.type ?? "committee";
        const description = options?.description ?? "A test group";
        const finesActivated = options?.finesActivated ?? false;
        const finesAdminId = options?.finesAdminId ?? null;

        const [group] = await ctx.db
            .insert(schema.group)
            .values({
                slug,
                name,
                type,
                finesActivated,
                finesAdminId,
                finesInfo: "",
                description,
                contactEmail: "test@example.com",
            })
            .returning();

        if (!group) {
            throw new Error("Failed to create test group");
        }

        return group;
    };
