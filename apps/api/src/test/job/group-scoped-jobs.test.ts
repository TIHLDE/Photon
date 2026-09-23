import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * A job posting belongs to TIHLDE, not to a group, so a grant held "for NoK"
 * has nothing to narrow against. It counts for nothing; NoKs Annonsør holds
 * the job globally instead. A grant for one single posting still opens that
 * one.
 */
describe("Group-scoped job permissions", () => {
    integrationTest(
        "a group-scoped grant opens nothing, a TIHLDE-wide one opens every posting",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const scopedHolder = await ctx.utils.createTestUser();
            const annonsor = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["jobs:manage"]);

            await ctx.db.insert(schema.userPermission).values(
                ["jobs:create", "jobs:update", "jobs:delete"].map(
                    (permission) => ({
                        userId: scopedHolder.id,
                        permission,
                        scope: "group:nok",
                    }),
                ),
            );
            await ctx.db.insert(schema.userPermission).values(
                ["jobs:create", "jobs:update", "jobs:delete"].map(
                    (permission) => ({
                        userId: annonsor.id,
                        permission,
                        scope: "*",
                    }),
                ),
            );

            const adminClient = await ctx.utils.clientForUser(admin);
            const scopedClient = await ctx.utils.clientForUser(scopedHolder);
            const annonsorClient = await ctx.utils.clientForUser(annonsor);

            const job = {
                ingress: "Ingress",
                body: "Body",
                company: "Test AS",
                location: "Trondheim",
                deadline: new Date(Date.now() + 86_400_000).toISOString(),
                isContinuouslyHiring: false,
                jobType: "full_time" as const,
                email: "hr@test.no",
                classStart: "first" as const,
                classEnd: "fifth" as const,
            };

            const scopedCreate = await scopedClient.api.jobs.$post({
                json: { ...job, title: "Should fail" },
            });
            expect(scopedCreate.status).toBe(403);

            const createResponse = await annonsorClient.api.jobs.$post({
                json: { ...job, title: "Published by Annonsør" },
            });
            expect(createResponse.status).toBe(201);

            const adminJob = await adminClient.api.jobs
                .$post({ json: { ...job, title: "Published by admin" } })
                .then((response) => response.json());

            const scopedUpdate = await scopedClient.api.jobs[":id"].$patch({
                param: { id: adminJob.id },
                json: { title: "Should fail" },
            });
            expect(scopedUpdate.status).toBe(403);

            const updateResponse = await annonsorClient.api.jobs[":id"].$patch({
                param: { id: adminJob.id },
                json: { title: "Corrected by Annonsør" },
            });
            expect(updateResponse.status).toBe(200);
        },
    );

    integrationTest(
        "a grant for one posting does not open the others",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const helper = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["jobs:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const job = {
                ingress: "Ingress",
                body: "Body",
                company: "Test AS",
                location: "Trondheim",
                deadline: new Date(Date.now() + 86_400_000).toISOString(),
                isContinuouslyHiring: false,
                jobType: "full_time" as const,
                email: "hr@test.no",
                classStart: "first" as const,
                classEnd: "fifth" as const,
            };

            const firstJob = await adminClient.api.jobs
                .$post({ json: { ...job, title: "First" } })
                .then((r) => r.json());
            const secondJob = await adminClient.api.jobs
                .$post({ json: { ...job, title: "Second" } })
                .then((r) => r.json());

            await ctx.db.insert(schema.userPermission).values({
                userId: helper.id,
                permission: "jobs:update",
                scope: `job-${firstJob.id}`,
            });

            const helperClient = await ctx.utils.clientForUser(helper);

            const allowed = await helperClient.api.jobs[":id"].$patch({
                param: { id: firstJob.id },
                json: { title: "Edited the one I was given" },
            });
            expect(allowed.status).toBe(200);

            const refused = await helperClient.api.jobs[":id"].$patch({
                param: { id: secondJob.id },
                json: { title: "Should fail" },
            });
            expect(refused.status).toBe(403);
        },
    );
});
