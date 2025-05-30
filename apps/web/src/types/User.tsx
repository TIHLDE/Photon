import type { PermissionApp } from '@/types/Enums';
import type { Group, MembershipWithoutUser } from '@/types/Group';
import type { Permissions } from '@/types/Misc';
import type { UserBio } from '@/types/UserBio';

export type LoginRequestResponse = {
  token: string;
};

export type User = {
  allergy: string;
  email: string;
  first_name: string;
  gender: number;
  image: string;
  last_name: string;
  tool: string;
  unread_notifications: number;
  user_id: string;
  unanswered_evaluations_count: number;
  number_of_strikes: number;
  public_event_registrations: boolean;
  accepts_event_rules: boolean;
  allows_photo_by_default: boolean;
  slack_user_id: string;
  study: MembershipWithoutUser;
  studyyear: MembershipWithoutUser;
  bio: UserBio;
};

export type UserBase = Pick<User, 'user_id' | 'first_name' | 'last_name' | 'image' | 'email' | 'gender' | 'study' | 'studyyear'>;
export type UserList = UserBase & Pick<User, 'email' | 'study' | 'studyyear' | 'allergy' | 'gender' | 'tool' | 'number_of_strikes'>;
export type UserCreate = Pick<User, 'email' | 'first_name' | 'last_name' | 'user_id'> & {
  password: string;
  study: Group['slug'] | null;
  class: Group['slug'] | null;
};

export type UserNotificationSetting = {
  notification_type: string;
  email: boolean;
  website: boolean;
  slack: boolean;
};

export type UserNotificationSettingChoice = {
  notification_type: string;
  label: string;
};

export type UserPermissions = {
  permissions: Record<PermissionApp, Permissions>;
};
