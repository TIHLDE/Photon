import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { photonClient } from "../apiClient";
import type { OnboardUserInput, UpdateUserSettingsInput } from "@tihlde/sdk";

export type { OnboardUserInput, UpdateUserSettingsInput, UpdateUserSettings, UserSettings, UserSettingsBase } from "@tihlde/sdk";

export const userKeys = {
  all: ["user"],
  settings: ["user", "settings"],
  allergies: ["user", "allergies"],
} as const;

export const getUserSettingsQuery = () =>
  queryOptions({
    queryKey: userKeys.settings,
    queryFn: () => photonClient.get("/api/user/me/settings").then((r) => r.unwrap().data),
  });

export const listAllergiesQuery = () =>
  queryOptions({
    queryKey: userKeys.allergies,
    queryFn: () => photonClient.get("/api/user/allergy").then((r) => r.unwrap().data),
  });

export const updateUserSettingsMutation = mutationOptions({
  mutationFn: (body: UpdateUserSettingsInput) => photonClient.patch("/api/user/me/settings", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: userKeys.settings });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: userKeys.settings });
  },
});

export const onboardUserMutation = mutationOptions({
  mutationFn: (body: OnboardUserInput) => photonClient.post("/api/user/me/settings", body).then((r) => r.unwrap().data),
  onMutate: async (_, ctx) => {
    await ctx.client.cancelQueries({ queryKey: userKeys.settings });
  },
  onSuccess: (_, __, ___, ctx) => {
    ctx.client.invalidateQueries({ queryKey: userKeys.settings });
  },
});
