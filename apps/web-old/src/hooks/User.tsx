import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import API from "~/api/api";
import type {
  Badge,
  EventList,
  Form,
  Membership,
  MembershipHistory,
  PaginationResponse,
  RequestResponse,
  User,
  UserList,
  UserNotificationSetting,
} from "~/types";

export const USER_QUERY_KEY = "user";
export const USER_BADGES_QUERY_KEY = "user_badges";
export const USER_EVENTS_QUERY_KEY = "user_events";
export const USER_MEMBERSHIPS_QUERY_KEY = "user_memberships";
export const USER_MEMBERSHIP_HISTORIES_QUERY_KEY = "user_membership_histories";
export const USER_FORMS_QUERY_KEY = "user_forms";
export const USER_STRIKES_QUERY_KEY = "user_strikes";
export const USER_PERMISSIONS_QUERY_KEY = "user_permissions";
export const USER_NOTIFICATION_SETTINGS_QUERY_KEY = "user_notification_settings";
export const USER_NOTIFICATION_SETTING_CHOICES_QUERY_KEY = "user_notification_setting_choices";
export const USERS_QUERY_KEY = "users";

export const useUserBadges = (userId?: User["user_id"]) =>
  useInfiniteQuery<PaginationResponse<Badge>, RequestResponse>({
    queryKey: [USER_BADGES_QUERY_KEY, userId],
    queryFn: ({ pageParam }) => API.getUserBadges(userId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });

export const useUserEvents = (userId?: User["user_id"], expired?: boolean) => {
  return useInfiniteQuery<PaginationResponse<EventList>, RequestResponse>({
    queryKey: [USER_EVENTS_QUERY_KEY, userId, expired],
    queryFn: ({ pageParam }) => API.getUserEvents(userId, { page: pageParam, expired: expired }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useUserForms = (filters?: any) =>
  useInfiniteQuery<PaginationResponse<Form>, RequestResponse>({
    queryKey: [USER_FORMS_QUERY_KEY, filters],
    queryFn: ({ pageParam }) => API.getUserForms({ ...(filters ?? {}), page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });

// TODO: Investigate if this needs to be an infinite query
export const useUserMemberships = (userId?: User["user_id"]) =>
  useInfiniteQuery<PaginationResponse<Membership>, RequestResponse>({
    queryKey: [USER_MEMBERSHIPS_QUERY_KEY, userId],
    queryFn: () => API.getUserMemberships(userId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });

// TODO: Investigate if this needs to ba an infinite query
export const useUserMembershipHistories = (userId?: User["user_id"]) =>
  useInfiniteQuery<PaginationResponse<MembershipHistory>, RequestResponse>({
    queryKey: [USER_MEMBERSHIP_HISTORIES_QUERY_KEY, userId],
    queryFn: () => API.getUserMembershipHistories(userId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });

export const useUserStrikes = (userId?: string) =>
  useQuery({
    queryKey: [USER_STRIKES_QUERY_KEY, userId],
    queryFn: () => API.getUserStrikes(userId),
  });

export const useUserNotificationSettings = () =>
  useQuery({
    queryKey: [USER_NOTIFICATION_SETTINGS_QUERY_KEY],
    queryFn: () => API.getUserNotificationSettings(),
  });

export const useUserNotificationSettingChoices = () =>
  useQuery({
    queryKey: [USER_NOTIFICATION_SETTING_CHOICES_QUERY_KEY],
    queryFn: () => API.getUserNotificationSettingChoices(),
  });

export const useUpdateUserNotificationSettings = (): UseMutationResult<Array<UserNotificationSetting>, RequestResponse, UserNotificationSetting, unknown> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.updateUserNotificationSettings(data),
    onSuccess: (data) => {
      queryClient.setQueryData([USER_NOTIFICATION_SETTINGS_QUERY_KEY], data);
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useUsers = (filters?: any) =>
  useInfiniteQuery<PaginationResponse<UserList>, RequestResponse>({
    queryKey: [USERS_QUERY_KEY, filters],
    queryFn: ({ pageParam }) => API.getUsers({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next,
  });

export const useExportUserData = (): UseMutationResult<RequestResponse, RequestResponse, unknown, unknown> =>
  useMutation({
    mutationFn: () => API.exportUserData(),
  });

export const useDeleteUser = (): UseMutationResult<RequestResponse, RequestResponse, string | undefined, unknown> =>
  useMutation({
    mutationFn: (userId) => API.deleteUser(userId),
  });

export const useActivateUser = (): UseMutationResult<RequestResponse, RequestResponse, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => API.activateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [USERS_QUERY_KEY],
      });
    },
  });
};

export const useDeclineUser = (): UseMutationResult<RequestResponse, RequestResponse, { userId: string; reason: string }, unknown> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }) => API.declineUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [USERS_QUERY_KEY],
      });
    },
  });
};
