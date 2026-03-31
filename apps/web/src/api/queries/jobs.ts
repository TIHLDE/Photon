import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import { QueryParamsHelper } from "@tihlde/sdk/types";
import type { CreateJob, UpdateJob } from "@tihlde/sdk";

export type { CreateJob, UpdateJob, JobDetail, JobList, JobListItem, DeleteJobResponse } from "@tihlde/sdk";

export type { JobListItem as JobListEntry } from "@tihlde/sdk";

export const jobKeys = {
  all: ["jobs"],
  infinite: ["jobs", "infinite"],
  lists: ["jobs", "list"],
  details: ["jobs", "detail"],
} as const;

const DEFAULT_PAGE_SIZE = 20;

export type JobFilters = QueryParamsHelper<"get", "/api/jobs">;

export const listJobInfiniteQuery = (filters?: JobFilters) =>
  infiniteQueryOptions({
    queryKey: [...jobKeys.infinite, filters].filter(Boolean),
    queryFn: async ({ pageParam }) =>
      await photonClient
        .get("/api/jobs", {
          queryParams: {
            ...filters,
            page: pageParam,
            pageSize: DEFAULT_PAGE_SIZE,
          },
        })
        .then((r) => r.unwrap().data),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

export const listJobsQuery = (page: number, pageSize = DEFAULT_PAGE_SIZE, filters: Omit<JobFilters, "page" | "pageSize"> = {}) =>
  queryOptions({
    queryKey: [...jobKeys.lists, filters, page, pageSize],
    queryFn: () =>
      photonClient
        .get("/api/jobs", {
          queryParams: { ...filters, page, pageSize },
        })
        .then((r) => r.unwrap().data),
    select: (data) => data.items,
  });

export const getJobQuery = (id: string) =>
  queryOptions({
    queryKey: [...jobKeys.details, id],
    queryFn: () =>
      photonClient
        .get("/api/jobs/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
  });

export const createJobMutation = mutationOptions({
  mutationFn: (body: CreateJob) => photonClient.post("/api/jobs", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: jobKeys.lists });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: jobKeys.lists });
  },
});

export const updateJobMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: UpdateJob) =>
      photonClient
        .patch("/api/jobs/{id}", body, {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onMutate: async (_, ctx) => {
      await ctx.client.cancelQueries({ queryKey: jobKeys.all });
    },
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: jobKeys.all });
    },
  });

export const deleteJobMutation = (id: string) =>
  mutationOptions({
    mutationFn: () =>
      photonClient
        .del("/api/jobs/{id}", {
          pathParams: { id },
        })
        .then((r) => r.unwrap().data),
    onSuccess: (_, __, ___, ctx) => {
      ctx.client.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
