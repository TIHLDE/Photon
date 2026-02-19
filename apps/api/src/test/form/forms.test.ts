import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Forms System", () => {
    integrationTest(
        "Complete form lifecycle: create template, event form, group form, submissions, and statistics",
        async ({ ctx }) => {
            // Setup users with different permissions
            const admin = await ctx.utils.createTestUser();
            const eventOrganizer = await ctx.utils.createTestUser();
            const groupLeader = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, [
                "forms:create",
                "forms:manage",
                "events:create",
            ]);
            await ctx.utils.giveUserPermissions(eventOrganizer, [
                "events:create",
            ]);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const adminClient = await ctx.utils.clientForUser(admin);
            const organizerClient =
                await ctx.utils.clientForUser(eventOrganizer);
            const leaderClient = await ctx.utils.clientForUser(groupLeader);
            const userClient = await ctx.utils.clientForUser(regularUser);

            // Make eventOrganizer a leader of the index group (so they can create event forms)
            await ctx.db.insert(schema.groupMembership).values({
                userId: eventOrganizer.id,
                groupSlug: "index",
                role: "leader",
            });

            // Make groupLeader a leader of a group
            await ctx.db.insert(schema.groupMembership).values({
                userId: groupLeader.id,
                groupSlug: "index",
                role: "leader",
            });

            // 1. Create a template form with multiple field types
            const templateResponse = await adminClient.api.forms.$post({
                json: {
                    title: "Template Survey",
                    description: "A reusable template",
                    template: true,
                    fields: [
                        {
                            title: "What is your name?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                        {
                            title: "How satisfied are you?",
                            type: "single_select",
                            required: true,
                            order: 1,
                            options: [
                                { title: "Very satisfied", order: 0 },
                                { title: "Satisfied", order: 1 },
                                { title: "Neutral", order: 2 },
                                { title: "Unsatisfied", order: 3 },
                            ],
                        },
                        {
                            title: "What features do you use?",
                            type: "multiple_select",
                            required: false,
                            order: 2,
                            options: [
                                { title: "Events", order: 0 },
                                { title: "Groups", order: 1 },
                                { title: "News", order: 2 },
                            ],
                        },
                    ],
                },
            });

            expect(templateResponse.status).toBe(201);
            const template = await templateResponse.json();
            expect(template.template).toBe(true);
            expect(template.fields).toHaveLength(3);

            // 2. Create an event and add survey + evaluation forms
            const eventResponse = await adminClient.api.event.$post({
                json: {
                    title: "Test Event",
                    description: "Test event for forms",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Oslo",
                    imageUrl: null,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: "2025-11-01T00:00:00Z",
                    registrationEnd: "2025-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(eventResponse.status).toBe(201);
            const eventData = await eventResponse.json();
            const eventId = eventData.eventId;

            // Create survey form for event
            const surveyResponse = await organizerClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId },
                json: {
                    title: "Pre-Event Survey",
                    description: "Survey before the event",
                    type: "survey",
                    event: eventId,
                    template: false,
                    fields: [
                        {
                            title: "What do you expect?",
                            type: "text_answer",
                            required: false,
                            order: 0,
                        },
                    ],
                },
            });

            expect(surveyResponse.status).toBe(201);
            const survey = await surveyResponse.json();
            expect(survey.type).toBe("survey");
            expect(survey.resource_type).toBe("EventForm");
            expect(survey.fields).toBeDefined();

            // Create evaluation form
            const evalResponse = await organizerClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId },
                json: {
                    title: "Post-Event Evaluation",
                    description: "Evaluation after the event",
                    type: "evaluation",
                    event: eventId,
                    template: false,
                    fields: [
                        {
                            title: "Rate the event",
                            type: "single_select",
                            required: true,
                            order: 0,
                            options: [
                                { title: "Excellent", order: 0 },
                                { title: "Good", order: 1 },
                                { title: "Average", order: 2 },
                                { title: "Poor", order: 3 },
                            ],
                        },
                    ],
                },
            });

            expect(evalResponse.status).toBe(201);

            // List event forms
            const eventFormsResponse = await userClient.api.event[
                ":eventId"
            ].forms.$get({
                param: { eventId },
            });
            expect(eventFormsResponse.status).toBe(200);
            const eventForms = await eventFormsResponse.json();
            expect(eventForms).toHaveLength(2);

            // 3. Test submission to survey form (anyone can submit)
            const surveySubmitResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: survey.id! },
                json: {
                    answers: [
                        {
                            field: { id: survey.fields?.[0]?.id },
                            answer_text: "I expect to learn a lot!",
                        },
                    ],
                },
            });

            expect(surveySubmitResponse.status).toBe(201);

            // 4. Create group form with restrictions
            const groupFormResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Group Feedback Form",
                    description: "Feedback for group members",
                    template: false,
                    group: "index",
                    email_receiver_on_submit: "test@example.com",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: true,
                    fields: [
                        {
                            title: "Your feedback",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });

            expect(groupFormResponse.status).toBe(201);
            const groupForm = await groupFormResponse.json();
            expect(groupForm.resource_type).toBe("GroupForm");
            expect(groupForm.fields).toBeDefined();

            // Non-member cannot submit to member-only form
            const nonMemberSubmitResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: groupForm.id! },
                json: {
                    answers: [
                        {
                            field: { id: groupForm.fields?.[0]?.id },
                            answer_text: "This should fail",
                        },
                    ],
                },
            });

            expect(nonMemberSubmitResponse.status).toBe(403);

            // Make regularUser a member
            await ctx.db.insert(schema.groupMembership).values({
                userId: regularUser.id,
                groupSlug: "index",
                role: "member",
            });

            // Now member can submit
            const memberSubmitResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: groupForm.id! },
                json: {
                    answers: [
                        {
                            field: { id: groupForm.fields?.[0]?.id },
                            answer_text: "Great group!",
                        },
                    ],
                },
            });

            expect(memberSubmitResponse.status).toBe(201);

            // Cannot submit again (can_submit_multiple = false)
            const duplicateSubmitResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: groupForm.id! },
                json: {
                    answers: [
                        {
                            field: { id: groupForm.fields?.[0]?.id },
                            answer_text: "Trying again",
                        },
                    ],
                },
            });

            expect(duplicateSubmitResponse.status).toBe(409);

            // 5. Test form with multiple select options and statistics
            const statsFormResponse = await adminClient.api.forms.$post({
                json: {
                    title: "Statistics Test Form",
                    description: "For testing stats",
                    template: false,
                    fields: [
                        {
                            title: "Pick colors",
                            type: "multiple_select",
                            required: false,
                            order: 0,
                            options: [
                                { title: "Red", order: 0 },
                                { title: "Blue", order: 1 },
                                { title: "Green", order: 2 },
                            ],
                        },
                    ],
                },
            });

            const statsForm = await statsFormResponse.json();
            expect(statsForm.fields).toBeDefined();

            // Submit multiple responses with different selections
            for (const user of [regularUser, groupLeader, eventOrganizer]) {
                const client = await ctx.utils.clientForUser(user);
                await client.api.forms[":formId"].submissions.$post({
                    param: { formId: statsForm.id! },
                    json: {
                        answers: [
                            {
                                field: { id: statsForm.fields?.[0]?.id },
                                selected_options: [
                                    {
                                        id: statsForm.fields?.[0]?.options?.[0]
                                            ?.id,
                                    }, // Red
                                    {
                                        id: statsForm.fields?.[0]?.options?.[1]
                                            ?.id,
                                    }, // Blue
                                ],
                            },
                        ],
                    },
                });
            }

            // Get statistics
            const statsResponse = await adminClient.api.forms[
                ":id"
            ].statistics.$get({
                param: { id: statsForm.id! },
            });

            expect(statsResponse.status).toBe(200);
            const stats = await statsResponse.json();
            expect(stats.statistics).toHaveLength(1);
            expect(stats.statistics?.[0]?.options?.[0]?.answer_amount).toBe(3); // Red selected 3 times
            expect(stats.statistics?.[0]?.options?.[1]?.answer_amount).toBe(3); // Blue selected 3 times
            expect(stats.statistics?.[0]?.options?.[2]?.answer_amount).toBe(0); // Green not selected
            expect(stats.statistics?.[0]?.options?.[0]?.answer_percentage).toBe(
                100,
            );

            // 6. Test update form fields
            const updateResponse = await adminClient.api.forms[":id"].$patch({
                param: { id: template.id! },
                json: {
                    title: "Updated Template",
                    fields: [
                        {
                            id: template.fields?.[0]?.id,
                            title: "Updated question",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                        {
                            title: "New question",
                            type: "text_answer",
                            required: false,
                            order: 1,
                        },
                    ],
                },
            });

            expect(updateResponse.status).toBe(200);
            const updated = await updateResponse.json();
            expect(updated.title).toBe("Updated Template");
            expect(updated.fields).toHaveLength(2);
            expect(updated.fields?.[0]?.title).toBe("Updated question");

            // 7. Test list submissions and permissions
            const submissionsResponse = await adminClient.api.forms[
                ":formId"
            ].submissions.$get({
                param: { formId: statsForm.id! },
            });

            expect(submissionsResponse.status).toBe(200);
            const submissions = await submissionsResponse.json();
            expect(submissions).toHaveLength(3);

            // Regular user cannot list submissions
            const unauthorizedListResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$get({
                param: { formId: statsForm.id! },
            });

            expect(unauthorizedListResponse.status).toBe(403);

            // 8. Test delete form
            const deleteResponse = await adminClient.api.forms[":id"].$delete({
                param: { id: template.id! },
            });

            expect(deleteResponse.status).toBe(200);

            // 9. Test viewer_has_answered flag
            const formsListResponse = await userClient.api.forms.$get({
                query: { all: "true" },
            });

            expect(formsListResponse.status).toBe(200);
            const allForms = await formsListResponse.json();
            const answeredForm = allForms.find(
                (f: any) => f.id === statsForm.id,
            );
            expect(answeredForm?.viewer_has_answered).toBe(true);

            // 10. Test form field validation
            const invalidSubmitResponse = await userClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: statsForm.id! },
                json: {
                    answers: [
                        {
                            field: { id: statsForm.fields?.[0]?.id },
                            // Both answer_text and selected_options - should fail validation
                            answer_text: "text",
                            selected_options: [
                                { id: statsForm.fields?.[0]?.options?.[0]?.id },
                            ],
                        },
                    ],
                },
            });

            expect(invalidSubmitResponse.status).toBe(400);
        },
        120_000,
    );

    integrationTest(
        "Event form attendance validation and submission restrictions",
        async ({ ctx }) => {
            const organizer = await ctx.utils.createTestUser();
            const attendee = await ctx.utils.createTestUser();
            const nonAttendee = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(organizer, ["events:create"]);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            // Make organizer a leader of the index group (so they can create event forms)
            await ctx.db.insert(schema.groupMembership).values({
                userId: organizer.id,
                groupSlug: "index",
                role: "leader",
            });

            const organizerClient = await ctx.utils.clientForUser(organizer);
            const attendeeClient = await ctx.utils.clientForUser(attendee);
            const nonAttendeeClient =
                await ctx.utils.clientForUser(nonAttendee);

            // Create event
            const eventResponse = await organizerClient.api.event.$post({
                json: {
                    title: "Test Event",
                    description: "Event with evaluation",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Oslo",
                    imageUrl: null,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: "2025-11-01T00:00:00Z",
                    registrationEnd: "2025-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            const event = await eventResponse.json();
            const eventId = event.eventId;

            // Create evaluation form
            const evalResponse = await organizerClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId },
                json: {
                    title: "Evaluation",
                    type: "evaluation",
                    event: eventId,
                    template: false,
                    fields: [
                        {
                            title: "Rating",
                            type: "single_select",
                            required: true,
                            order: 0,
                            options: [
                                { title: "Good", order: 0 },
                                { title: "Bad", order: 1 },
                            ],
                        },
                    ],
                },
            });

            const evaluation = await evalResponse.json();
            expect(evaluation.fields).toBeDefined();

            // Mark attendee as attended
            await ctx.db.insert(schema.eventRegistration).values({
                eventId,
                userId: attendee.id,
                status: "attended",
            });

            // Attendee can submit evaluation
            const attendeeSubmitResponse = await attendeeClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: evaluation.id! },
                json: {
                    answers: [
                        {
                            field: { id: evaluation.fields?.[0]?.id },
                            selected_options: [
                                {
                                    id: evaluation.fields?.[0]?.options?.[0]
                                        ?.id,
                                },
                            ],
                        },
                    ],
                },
            });

            expect(attendeeSubmitResponse.status).toBe(201);

            // Non-attendee cannot submit evaluation
            const nonAttendeeSubmitResponse = await nonAttendeeClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: evaluation.id! },
                json: {
                    answers: [
                        {
                            field: { id: evaluation.fields?.[0]?.id },
                            selected_options: [
                                {
                                    id: evaluation.fields?.[0]?.options?.[0]
                                        ?.id,
                                },
                            ],
                        },
                    ],
                },
            });

            expect(nonAttendeeSubmitResponse.status).toBe(403);
        },
        60_000,
    );
});
