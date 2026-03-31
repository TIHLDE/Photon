import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import type { CreateForm, CreateSubmission, DeleteSubmissionWithReason, UpdateForm } from "@tihlde/sdk";

export type {
  CreateForm,
  CreateSubmission,
  DeleteSubmissionWithReason,
  UpdateForm,
  FormDetail,
  FormList,
  FormResponse,
  FormStatistics,
  SubmissionDetail,
  SubmissionList,
  CreateSubmissionResponse,
  DeleteFormResponse,
  DeleteSubmissionResponse,
  UpdateFormResponse,
} from "@tihlde/sdk";

export const formKeys = {
  all: ["forms"],
  lists: ["forms", "list"],
  details: ["forms", "detail"],
  statistics: ["forms", "statistics"],
  submissions: ["forms", "submissions"],
} as const;

export const listFormsQuery = () =>
  queryOptions({
    queryKey: formKeys.lists,
    queryFn: () => photonClient.get("/api/forms").then((r) => r.unwrap().data),
  });

export const getFormQuery = (id: string) =>
  queryOptions({
    queryKey: [...formKeys.details, id],
    queryFn: () =>
      photonClient
        .get("/api/forms/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
  });

export const getFormStatisticsQuery = (id: string) =>
  queryOptions({
    queryKey: [...formKeys.statistics, id],
    queryFn: () =>
      photonClient
        .get("/api/forms/{id}/statistics", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
  });

export const listFormSubmissionsQuery = (formId: string) =>
  queryOptions({
    queryKey: [...formKeys.submissions, formId],
    queryFn: () =>
      photonClient
        .get("/api/forms/{formId}/submissions", {
          pathParams: { formId },
        })
        .then((r) => r.unwrap().data),
  });

export const getFormSubmissionQuery = (formId: string, id: string) =>
  queryOptions({
    queryKey: [...formKeys.submissions, formId, id],
    queryFn: () =>
      photonClient
        .get("/api/forms/{formId}/submissions/{id}", {
          pathParams: { formId, id },
        })
        .then((r) => r.unwrap().data),
  });

export const createFormMutation = mutationOptions({
  mutationFn: (body: CreateForm) => photonClient.post("/api/forms", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: formKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: formKeys.lists });
  },
});

export const updateFormMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateForm) =>
      photonClient
        .patch("/api/forms/{id}", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: formKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: formKeys.all });
    },
  });

export const deleteFormMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/forms/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: formKeys.all });
    },
  });

export const createFormSubmissionMutation = (formId: string) =>
  mutationOptions({
    mutationFn: (body: CreateSubmission) =>
      photonClient
        .post("/api/forms/{formId}/submissions", body, {
          pathParams: { formId },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: formKeys.submissions });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: formKeys.submissions });
    },
  });

export const deleteFormSubmissionMutation = (formId: string, id: string) =>
  mutationOptions({
    mutationFn: (body: DeleteSubmissionWithReason) =>
      photonClient
        .del("/api/forms/{formId}/submissions/{id}/destroy_with_reason", {
          pathParams: { formId, id },
          body,
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: formKeys.submissions });
    },
  });
