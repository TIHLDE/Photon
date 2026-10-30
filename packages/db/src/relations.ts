import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

/**
 * Relations for the relational query builder (`db.query`), in Drizzle's v2
 * format. Every relation names both ends explicitly, so nothing depends on
 * Drizzle pairing up the two sides on its own.
 */
export const relations = defineRelations(schema, (r) => ({
    // api-key.ts
    managedApiKey: {
        creator: r.one.user({
            from: r.managedApiKey.createdById,
            to: r.user.id,
        }),
    },
    // application.ts
    application: {
        submittedBy: r.one.user({
            from: r.application.submittedById,
            to: r.user.id,
            alias: "applicationSubmitter",
        }),
        handledBy: r.one.user({
            from: r.application.handledById,
            to: r.user.id,
            alias: "applicationHandler",
        }),
        expense: r.one.applicationExpense({
            from: r.application.id,
            to: r.applicationExpense.applicationId,
        }),
        support: r.one.applicationSupport({
            from: r.application.id,
            to: r.applicationSupport.applicationId,
        }),
        hsCase: r.one.applicationHsCase({
            from: r.application.id,
            to: r.applicationHsCase.applicationId,
        }),
        companyContact: r.one.applicationCompanyContact({
            from: r.application.id,
            to: r.applicationCompanyContact.applicationId,
        }),
        attachments: r.many.applicationAttachment({
            from: r.application.id,
            to: r.applicationAttachment.applicationId,
        }),
    },
    applicationExpense: {
        application: r.one.application({
            from: r.applicationExpense.applicationId,
            to: r.application.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.applicationExpense.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    applicationSupport: {
        application: r.one.application({
            from: r.applicationSupport.applicationId,
            to: r.application.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.applicationSupport.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    applicationHsCase: {
        application: r.one.application({
            from: r.applicationHsCase.applicationId,
            to: r.application.id,
            optional: false,
        }),
    },
    applicationCompanyContact: {
        application: r.one.application({
            from: r.applicationCompanyContact.applicationId,
            to: r.application.id,
            optional: false,
        }),
    },
    applicationAttachment: {
        application: r.one.application({
            from: r.applicationAttachment.applicationId,
            to: r.application.id,
            optional: false,
        }),
    },
    // asset.ts
    asset: {
        uploadedBy: r.one.user({
            from: r.asset.uploadedById,
            to: r.user.id,
        }),
    },
    // auth.ts
    user: {
        sessions: r.many.session({
            from: r.user.id,
            to: r.session.userId,
        }),
        accounts: r.many.account({
            from: r.user.id,
            to: r.account.userId,
        }),
        oauthClients: r.many.oauthClient({
            from: r.user.id,
            to: r.oauthClient.userId,
        }),
        oauthRefreshTokens: r.many.oauthRefreshToken({
            from: r.user.id,
            to: r.oauthRefreshToken.userId,
        }),
        oauthAccessTokens: r.many.oauthAccessToken({
            from: r.user.id,
            to: r.oauthAccessToken.userId,
        }),
        oauthConsents: r.many.oauthConsent({
            from: r.user.id,
            to: r.oauthConsent.userId,
        }),
        /**
         * Declared from this side, not from `userSettings`, so a user with no
         * settings row still answers: three accounts in production have none,
         * and `approvalStatus` — read alongside the settings on every
         * `get-session` — would silently read as "approved" for them if the
         * query started at the settings table.
         */
        settings: r.one.userSettings({
            from: r.user.id,
            to: r.userSettings.userId,
        }),
        studyProgramMemberships: r.many.studyProgramMembership({
            from: r.user.id,
            to: r.studyProgramMembership.userId,
        }),
    },
    session: {
        user: r.one.user({
            from: r.session.userId,
            to: r.user.id,
            optional: false,
        }),
        oauthRefreshTokens: r.many.oauthRefreshToken({
            from: r.session.id,
            to: r.oauthRefreshToken.sessionId,
        }),
        oauthAccessTokens: r.many.oauthAccessToken({
            from: r.session.id,
            to: r.oauthAccessToken.sessionId,
        }),
    },
    account: {
        user: r.one.user({
            from: r.account.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    oauthClient: {
        user: r.one.user({
            from: r.oauthClient.userId,
            to: r.user.id,
        }),
        oauthRefreshTokens: r.many.oauthRefreshToken({
            from: r.oauthClient.clientId,
            to: r.oauthRefreshToken.clientId,
        }),
        oauthAccessTokens: r.many.oauthAccessToken({
            from: r.oauthClient.clientId,
            to: r.oauthAccessToken.clientId,
        }),
        oauthConsents: r.many.oauthConsent({
            from: r.oauthClient.clientId,
            to: r.oauthConsent.clientId,
        }),
    },
    oauthRefreshToken: {
        oauthClient: r.one.oauthClient({
            from: r.oauthRefreshToken.clientId,
            to: r.oauthClient.clientId,
            optional: false,
        }),
        session: r.one.session({
            from: r.oauthRefreshToken.sessionId,
            to: r.session.id,
        }),
        user: r.one.user({
            from: r.oauthRefreshToken.userId,
            to: r.user.id,
            optional: false,
        }),
        oauthAccessTokens: r.many.oauthAccessToken({
            from: r.oauthRefreshToken.id,
            to: r.oauthAccessToken.refreshId,
        }),
    },
    oauthAccessToken: {
        oauthClient: r.one.oauthClient({
            from: r.oauthAccessToken.clientId,
            to: r.oauthClient.clientId,
            optional: false,
        }),
        session: r.one.session({
            from: r.oauthAccessToken.sessionId,
            to: r.session.id,
        }),
        user: r.one.user({
            from: r.oauthAccessToken.userId,
            to: r.user.id,
        }),
        oauthRefreshToken: r.one.oauthRefreshToken({
            from: r.oauthAccessToken.refreshId,
            to: r.oauthRefreshToken.id,
        }),
    },
    oauthConsent: {
        oauthClient: r.one.oauthClient({
            from: r.oauthConsent.clientId,
            to: r.oauthClient.clientId,
            optional: false,
        }),
        user: r.one.user({
            from: r.oauthConsent.userId,
            to: r.user.id,
        }),
    },
    // banner.ts
    banner: {
        creator: r.one.user({
            from: r.banner.createdById,
            to: r.user.id,
        }),
    },
    // event.ts
    event: {
        category: r.one.eventCategory({
            from: r.event.categorySlug,
            to: r.eventCategory.slug,
            optional: false,
        }),
        organizer: r.one.group({
            from: r.event.organizerGroupSlug,
            to: r.group.slug,
        }),
        restrictedToInstitute: r.one.institute({
            from: r.event.restrictedToInstituteId,
            to: r.institute.id,
        }),
        contactPerson: r.one.user({
            from: r.event.contactPersonId,
            to: r.user.id,
        }),
        reactions: r.many.eventReaction({
            from: r.event.id,
            to: r.eventReaction.eventId,
        }),
        pools: r.many.eventPriorityPool({
            from: r.event.id,
            to: r.eventPriorityPool.eventId,
        }),
        priorityUsers: r.many.eventPriorityUser({
            from: r.event.id,
            to: r.eventPriorityUser.eventId,
        }),
        favorites: r.many.eventFavorite({
            from: r.event.id,
            to: r.eventFavorite.eventId,
        }),
        registrations: r.many.eventRegistration({
            from: r.event.id,
            to: r.eventRegistration.eventId,
        }),
    },
    eventRegistration: {
        event: r.one.event({
            from: r.eventRegistration.eventId,
            to: r.event.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.eventRegistration.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    eventStrike: {
        event: r.one.event({
            from: r.eventStrike.eventId,
            to: r.event.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.eventStrike.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    eventPayment: {
        event: r.one.event({
            from: r.eventPayment.eventId,
            to: r.event.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.eventPayment.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    eventFeedback: {
        event: r.one.event({
            from: r.eventFeedback.eventId,
            to: r.event.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.eventFeedback.userId,
            to: r.user.id,
        }),
    },
    eventCategory: {
        events: r.many.event({
            from: r.eventCategory.slug,
            to: r.event.categorySlug,
        }),
    },
    eventReaction: {
        user: r.one.user({
            from: r.eventReaction.userId,
            to: r.user.id,
            optional: false,
        }),
        event: r.one.event({
            from: r.eventReaction.eventId,
            to: r.event.id,
            optional: false,
        }),
    },
    eventPriorityPool: {
        event: r.one.event({
            from: r.eventPriorityPool.eventId,
            to: r.event.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.eventPriorityPool.groupSlug,
            to: r.group.slug,
        }),
    },
    eventPriorityPoolGroup: {
        priorityPool: r.one.eventPriorityPool({
            from: r.eventPriorityPoolGroup.priorityPoolId,
            to: r.eventPriorityPool.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.eventPriorityPoolGroup.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    eventPriorityUser: {
        event: r.one.event({
            from: r.eventPriorityUser.eventId,
            to: r.event.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.eventPriorityUser.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    eventFavorite: {
        user: r.one.user({
            from: r.eventFavorite.userId,
            to: r.user.id,
            optional: false,
        }),
        event: r.one.event({
            from: r.eventFavorite.eventId,
            to: r.event.id,
            optional: false,
        }),
    },
    eventMessage: {
        event: r.one.event({
            from: r.eventMessage.eventId,
            to: r.event.id,
            optional: false,
        }),
        sentBy: r.one.user({
            from: r.eventMessage.sentById,
            to: r.user.id,
        }),
    },
    // feedback.ts
    feedback: {
        author: r.one.user({
            from: r.feedback.authorId,
            to: r.user.id,
        }),
        votes: r.many.feedbackVote({
            from: r.feedback.id,
            to: r.feedbackVote.feedbackId,
        }),
        comments: r.many.feedbackComment({
            from: r.feedback.id,
            to: r.feedbackComment.feedbackId,
        }),
    },
    feedbackComment: {
        feedback: r.one.feedback({
            from: r.feedbackComment.feedbackId,
            to: r.feedback.id,
            optional: false,
        }),
        author: r.one.user({
            from: r.feedbackComment.authorId,
            to: r.user.id,
        }),
    },
    feedbackVote: {
        feedback: r.one.feedback({
            from: r.feedbackVote.feedbackId,
            to: r.feedback.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.feedbackVote.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    // form.ts
    form: {
        fields: r.many.formField({
            from: r.form.id,
            to: r.formField.formId,
        }),
        submissions: r.many.formSubmission({
            from: r.form.id,
            to: r.formSubmission.formId,
        }),
        eventForms: r.many.formEventForm({
            from: r.form.id,
            to: r.formEventForm.formId,
        }),
        groupForms: r.many.formGroupForm({
            from: r.form.id,
            to: r.formGroupForm.formId,
        }),
    },
    formEventForm: {
        form: r.one.form({
            from: r.formEventForm.formId,
            to: r.form.id,
            optional: false,
        }),
        event: r.one.event({
            from: r.formEventForm.eventId,
            to: r.event.id,
            optional: false,
        }),
    },
    formGroupForm: {
        form: r.one.form({
            from: r.formGroupForm.formId,
            to: r.form.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.formGroupForm.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    formField: {
        form: r.one.form({
            from: r.formField.formId,
            to: r.form.id,
            optional: false,
        }),
        options: r.many.formOption({
            from: r.formField.id,
            to: r.formOption.fieldId,
        }),
        answers: r.many.formAnswer({
            from: r.formField.id,
            to: r.formAnswer.fieldId,
        }),
    },
    formOption: {
        field: r.one.formField({
            from: r.formOption.fieldId,
            to: r.formField.id,
            optional: false,
        }),
        answers: r.many.formAnswerOption({
            from: r.formOption.id,
            to: r.formAnswerOption.optionId,
        }),
    },
    formSubmission: {
        form: r.one.form({
            from: r.formSubmission.formId,
            to: r.form.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.formSubmission.userId,
            to: r.user.id,
            optional: false,
        }),
        answers: r.many.formAnswer({
            from: r.formSubmission.id,
            to: r.formAnswer.submissionId,
        }),
    },
    formAnswer: {
        submission: r.one.formSubmission({
            from: r.formAnswer.submissionId,
            to: r.formSubmission.id,
            optional: false,
        }),
        field: r.one.formField({
            from: r.formAnswer.fieldId,
            to: r.formField.id,
        }),
        selectedOptions: r.many.formAnswerOption({
            from: r.formAnswer.id,
            to: r.formAnswerOption.answerId,
        }),
    },
    formAnswerOption: {
        answer: r.one.formAnswer({
            from: r.formAnswerOption.answerId,
            to: r.formAnswer.id,
            optional: false,
        }),
        option: r.one.formOption({
            from: r.formAnswerOption.optionId,
            to: r.formOption.id,
            optional: false,
        }),
    },
    // gallery.ts
    galleryAlbum: {
        creator: r.one.user({
            from: r.galleryAlbum.createdById,
            to: r.user.id,
        }),
        event: r.one.event({
            from: r.galleryAlbum.eventId,
            to: r.event.id,
        }),
        pictures: r.many.galleryPicture({
            from: r.galleryAlbum.id,
            to: r.galleryPicture.albumId,
        }),
    },
    galleryPicture: {
        album: r.one.galleryAlbum({
            from: r.galleryPicture.albumId,
            to: r.galleryAlbum.id,
            optional: false,
        }),
    },
    // job.ts
    jobPost: {
        creator: r.one.user({
            from: r.jobPost.createdById,
            to: r.user.id,
        }),
    },
    // news.ts
    news: {
        creator: r.one.user({
            from: r.news.createdById,
            to: r.user.id,
        }),
        reactions: r.many.newsReaction({
            from: r.news.id,
            to: r.newsReaction.newsId,
        }),
    },
    newsReaction: {
        user: r.one.user({
            from: r.newsReaction.userId,
            to: r.user.id,
            optional: false,
        }),
        news: r.one.news({
            from: r.newsReaction.newsId,
            to: r.news.id,
            optional: false,
        }),
    },
    // org.ts
    studyProgramMembership: {
        user: r.one.user({
            from: r.studyProgramMembership.userId,
            to: r.user.id,
            optional: false,
        }),
        studyProgram: r.one.studyProgram({
            from: r.studyProgramMembership.studyProgramId,
            to: r.studyProgram.id,
            optional: false,
        }),
    },
    group: {
        institute: r.one.institute({
            from: r.group.instituteId,
            to: r.institute.id,
        }),
    },
    institute: {
        groups: r.many.group({
            from: r.institute.id,
            to: r.group.instituteId,
        }),
    },
    groupMembership: {
        user: r.one.user({
            from: r.groupMembership.userId,
            to: r.user.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.groupMembership.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    groupJoinRequest: {
        user: r.one.user({
            from: r.groupJoinRequest.userId,
            to: r.user.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.groupJoinRequest.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    groupMembershipHistory: {
        user: r.one.user({
            from: r.groupMembershipHistory.userId,
            to: r.user.id,
            optional: false,
        }),
        group: r.one.group({
            from: r.groupMembershipHistory.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    groupPosition: {
        group: r.one.group({
            from: r.groupPosition.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
        holders: r.many.groupPositionHolder({
            from: r.groupPosition.id,
            to: r.groupPositionHolder.positionId,
        }),
    },
    groupPositionHolder: {
        position: r.one.groupPosition({
            from: r.groupPositionHolder.positionId,
            to: r.groupPosition.id,
            optional: false,
        }),
        user: r.one.user({
            from: r.groupPositionHolder.userId,
            to: r.user.id,
            optional: false,
        }),
    },
    fine: {
        user: r.one.user({
            from: r.fine.userId,
            to: r.user.id,
            alias: "fineUser",
            optional: false,
        }),
        createdByUser: r.one.user({
            from: r.fine.createdByUserId,
            to: r.user.id,
            alias: "fineCreatedByUser",
        }),
        law: r.one.groupLaw({
            from: r.fine.lawId,
            to: r.groupLaw.id,
        }),
    },
    groupLaw: {
        group: r.one.group({
            from: r.groupLaw.groupSlug,
            to: r.group.slug,
            optional: false,
        }),
    },
    // user.ts
    userSettings: {
        allergies: r.many.userAllergy({
            from: r.userSettings.userId,
            to: r.userAllergy.userId,
        }),
    },
    allergy: {
        userSettings: r.many.userAllergy({
            from: r.allergy.slug,
            to: r.userAllergy.allergySlug,
        }),
    },
    userAllergy: {
        userSettings: r.one.userSettings({
            from: r.userAllergy.userId,
            to: r.userSettings.userId,
            optional: false,
        }),
        allergy: r.one.allergy({
            from: r.userAllergy.allergySlug,
            to: r.allergy.slug,
            optional: false,
        }),
    },
}));
