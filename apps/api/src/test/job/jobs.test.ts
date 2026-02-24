import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Job Postings System", () => {
    integrationTest(
        "Complete job lifecycle: create, list with filters, get, update, delete",
        async ({ ctx }) => {
            // Setup users with different permissions
            const admin = await ctx.utils.createTestUser();
            const recruiter = await ctx.utils.createTestUser();
            const poster = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["jobs:manage"]);
            await ctx.utils.giveUserPermissions(recruiter, [
                "jobs:create",
                "jobs:update",
            ]);
            await ctx.utils.giveUserPermissions(poster, ["jobs:create"]);

            const adminClient = await ctx.utils.clientForUser(admin);
            const recruiterClient = await ctx.utils.clientForUser(recruiter);
            const posterClient = await ctx.utils.clientForUser(poster);
            const userClient = await ctx.utils.clientForUser(regularUser);

            // === CREATE JOB POSTINGS ===

            // 1. Poster creates active job posting
            const activeJobResponse = await posterClient.api.jobs.$post({
                json: {
                    title: "Senior Developer Position",
                    ingress: "We are looking for an experienced developer",
                    body: "Join our team and work on exciting projects...",
                    company: "Tech Corp",
                    location: "Oslo, Norway",
                    deadline: new Date(
                        Date.now() + 30 * 24 * 60 * 60 * 1000,
                    ).toISOString(), // 30 days from now
                    isContinuouslyHiring: false,
                    jobType: "full_time",
                    email: "hr@techcorp.com",
                    link: "https://techcorp.com/careers",
                    classStart: "third",
                    classEnd: "fifth",
                    imageUrl: "https://techcorp.com/logo.png",
                    imageAlt: "Tech Corp Logo",
                },
            });

            expect(activeJobResponse.status).toBe(201);
            const activeJob = await activeJobResponse.json();
            expect(activeJob.title).toBe("Senior Developer Position");
            expect(activeJob.jobType).toBe("full_time");
            expect(activeJob.createdById).toBe(poster.id);

            // 2. Regular user cannot create job without permission
            const unauthorizedCreateResponse = await userClient.api.jobs.$post({
                json: {
                    title: "Unauthorized Job",
                    ingress: "Should fail",
                    body: "This should not be created",
                    company: "Fail Corp",
                    location: "Oslo",
                    jobType: "other",
                },
            });

            expect(unauthorizedCreateResponse.status).toBe(403);

            // 3. Create expired job posting
            const expiredJobResponse = await recruiterClient.api.jobs.$post({
                json: {
                    title: "Expired Summer Job",
                    ingress: "Summer internship",
                    body: "Great opportunity for students",
                    company: "Summer Corp",
                    location: "Bergen",
                    deadline: new Date(
                        Date.now() - 10 * 24 * 60 * 60 * 1000,
                    ).toISOString(), // 10 days ago
                    jobType: "summer_job",
                    classStart: "first",
                    classEnd: "second",
                },
            });

            expect(expiredJobResponse.status).toBe(201);
            const expiredJob = await expiredJobResponse.json();

            // 4. Create continuously hiring job
            const continuousJobResponse = await recruiterClient.api.jobs.$post({
                json: {
                    title: "Part-time Developer",
                    ingress: "Flexible hours",
                    body: "Join us on a part-time basis",
                    company: "Flexible Corp",
                    location: "Remote",
                    isContinuouslyHiring: true,
                    jobType: "part_time",
                    classStart: "first",
                    classEnd: "alumni",
                },
            });

            expect(continuousJobResponse.status).toBe(201);

            // 5. Validate class range (classStart must be <= classEnd)
            const invalidClassRangeResponse =
                await recruiterClient.api.jobs.$post({
                    json: {
                        title: "Invalid Class Range Job",
                        ingress: "This should fail",
                        body: "Invalid validation",
                        company: "Fail Corp",
                        location: "Oslo",
                        jobType: "other",
                        classStart: "fifth",
                        classEnd: "first", // Invalid: fifth > first
                    },
                });

            expect(invalidClassRangeResponse.status).toBe(400);

            // === LIST JOB POSTINGS ===

            // 6. Anyone can list jobs (public endpoint)
            const listResponse = await userClient.api.jobs.$get({ query: {} });
            expect(listResponse.status).toBe(200);
            const jobsList = await listResponse.json();

            // Should only show active jobs by default (not expired)
            expect(jobsList.items.length).toBe(2); // active job + continuously hiring
            expect(
                jobsList.items.find((j) => j.id === expiredJob.id),
            ).toBeUndefined();

            // 7. List with expired jobs included
            const listWithExpiredResponse = await userClient.api.jobs.$get({
                query: { expired: "true" },
            });

            const allJobs = await listWithExpiredResponse.json();
            expect(allJobs.items.length).toBe(3); // all jobs
            expect(
                allJobs.items.find((j) => j.id === expiredJob.id),
            ).toBeDefined();

            // 8. Verify expired field is computed correctly
            const activeJobInList = allJobs.items.find(
                (j) => j.id === activeJob.id,
            );
            expect(activeJobInList?.expired).toBe(false);

            const expiredJobInList = allJobs.items.find(
                (j) => j.id === expiredJob.id,
            );
            expect(expiredJobInList?.expired).toBe(true);

            // 9. Search by title
            const searchByTitleResponse = await userClient.api.jobs.$get({
                query: { search: "Developer" },
            });

            const searchTitleResults = await searchByTitleResponse.json();
            expect(searchTitleResults.items.length).toBe(2); // Two jobs with "Developer" in title
            expect(
                searchTitleResults.items.every((j) =>
                    j.title.includes("Developer"),
                ),
            ).toBe(true);

            // 10. Search by company
            const searchByCompanyResponse = await userClient.api.jobs.$get({
                query: { search: "Tech Corp" },
            });

            const searchCompanyResults = await searchByCompanyResponse.json();
            expect(searchCompanyResults.items.length).toBe(1);
            expect(searchCompanyResults.items[0]?.company).toBe("Tech Corp");

            // === GET SINGLE JOB ===

            // 11. Anyone can get a single job (public endpoint)
            const getResponse = await userClient.api.jobs[":id"].$get({
                param: { id: activeJob.id },
            });

            expect(getResponse.status).toBe(200);
            const fetchedJob = await getResponse.json();
            expect(fetchedJob.id).toBe(activeJob.id);
            expect(fetchedJob.title).toBe("Senior Developer Position");
            expect(fetchedJob.expired).toBe(false);
            expect(fetchedJob.creator).toBeDefined();
            expect(fetchedJob.creator?.id).toBe(poster.id);

            // 12. 404 for non-existent job
            const notFoundResponse = await userClient.api.jobs[":id"].$get({
                param: { id: "00000000-0000-0000-0000-000000000000" },
            });

            expect(notFoundResponse.status).toBe(404);

            // === UPDATE JOB POSTINGS ===

            // 13. Poster can update their own job
            const posterUpdateResponse = await posterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    title: "Updated Senior Developer Position",
                    location: "Oslo / Remote",
                },
            });

            expect(posterUpdateResponse.status).toBe(200);
            const updatedByPoster = await posterUpdateResponse.json();
            expect(updatedByPoster.title).toBe(
                "Updated Senior Developer Position",
            );
            expect(updatedByPoster.location).toBe("Oslo / Remote");

            // 14. Recruiter with global permission can update any job
            const recruiterUpdateResponse = await recruiterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    ingress: "Updated by recruiter",
                },
            });

            expect(recruiterUpdateResponse.status).toBe(200);
            const updatedByRecruiter = await recruiterUpdateResponse.json();
            expect(updatedByRecruiter.ingress).toBe("Updated by recruiter");

            // 15. Regular user cannot update job they don't own
            const unauthorizedUpdateResponse = await userClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    title: "Should fail",
                },
            });

            expect(unauthorizedUpdateResponse.status).toBe(403);

            // 16. Update with class range validation
            const validClassUpdateResponse = await posterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    classStart: "first",
                    classEnd: "alumni",
                },
            });

            expect(validClassUpdateResponse.status).toBe(200);

            // 17. Invalid class range update should fail
            const invalidClassUpdateResponse = await posterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    classStart: "fifth",
                    classEnd: "second",
                },
            });

            expect(invalidClassUpdateResponse.status).toBe(400);

            // 18. Update only classStart with validation
            const updateClassStartResponse = await posterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    classStart: "second",
                },
            });

            expect(updateClassStartResponse.status).toBe(200);

            // 19. Update classStart beyond classEnd should fail
            const invalidClassStartResponse = await recruiterClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: expiredJob.id }, // classEnd is "second"
                json: {
                    classStart: "fifth", // fifth > second
                },
            });

            expect(invalidClassStartResponse.status).toBe(400);

            // 20. Test scoped permission for update
            await ctx.db.insert(schema.userPermission).values({
                userId: regularUser.id,
                permission: "jobs:update",
                scope: `job-${expiredJob.id}`,
            });

            const scopedUpdateResponse = await userClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: expiredJob.id },
                json: {
                    title: "Updated via scoped permission",
                },
            });

            expect(scopedUpdateResponse.status).toBe(200);

            // But scoped permission doesn't work for other jobs
            const scopedUpdateFailResponse = await userClient.api.jobs[
                ":id"
            ].$patch({
                param: { id: activeJob.id },
                json: {
                    title: "Should still fail",
                },
            });

            expect(scopedUpdateFailResponse.status).toBe(403);

            // === DELETE JOB POSTINGS ===

            // 21. Regular user cannot delete job they don't own
            const unauthorizedDeleteResponse = await userClient.api.jobs[
                ":id"
            ].$delete({
                param: { id: expiredJob.id },
            });

            expect(unauthorizedDeleteResponse.status).toBe(403);

            // 22. Poster can delete their own job
            const posterDeleteResponse = await posterClient.api.jobs[
                ":id"
            ].$delete({
                param: { id: activeJob.id },
            });

            expect(posterDeleteResponse.status).toBe(200);

            // Verify it's deleted
            const deletedCheckResponse = await userClient.api.jobs[":id"].$get({
                param: { id: activeJob.id },
            });

            expect(deletedCheckResponse.status).toBe(404);

            // 23. Admin can delete any job
            const adminDeleteResponse = await adminClient.api.jobs[
                ":id"
            ].$delete({
                param: { id: expiredJob.id },
            });

            expect(adminDeleteResponse.status).toBe(200);

            // 24. Test scoped delete permission
            const jobForScopedDelete = await recruiterClient.api.jobs.$post({
                json: {
                    title: "Test Scoped Delete",
                    ingress: "For testing",
                    body: "Will be deleted via scoped permission",
                    company: "Test Corp",
                    location: "Oslo",
                    jobType: "other",
                },
            });

            const scopedJobData = await jobForScopedDelete.json();

            await ctx.db.insert(schema.userPermission).values({
                userId: regularUser.id,
                permission: "jobs:delete",
                scope: `job-${scopedJobData.id}`,
            });

            const scopedDeleteResponse = await userClient.api.jobs[
                ":id"
            ].$delete({
                param: { id: scopedJobData.id },
            });

            expect(scopedDeleteResponse.status).toBe(200);

            // === EDGE CASES ===

            // 25. Create job with minimal required fields
            const minimalJobResponse = await posterClient.api.jobs.$post({
                json: {
                    title: "Minimal Job",
                    company: "Min Corp",
                    location: "Oslo",
                    jobType: "other",
                },
            });

            expect(minimalJobResponse.status).toBe(201);
            const minimalJob = await minimalJobResponse.json();
            expect(minimalJob.ingress).toBe("");
            expect(minimalJob.body).toBe("");
            expect(minimalJob.classStart).toBe("first");
            expect(minimalJob.classEnd).toBe("fifth");

            // 26. Verify ordering by createdAt (newest first)
            const finalListResponse = await userClient.api.jobs.$get({
                query: { expired: "true" },
            });

            const finalList = await finalListResponse.json();
            expect(finalList.items.length).toBeGreaterThan(0);
            // First item should be the most recently created (minimalJob)
            expect(finalList.items[0]?.id).toBe(minimalJob.id);
        },
        120_000,
    );
});
