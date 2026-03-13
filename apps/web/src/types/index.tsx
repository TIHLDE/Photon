import type { UserBase } from "~/types/User";

export * from "~/types/Badge";
export * from "~/types/paidHistory";
export * from "~/types/Event";
export * from "~/types/Form";
export * from "~/types/Misc";
export * from "~/types/Group";
export * from "~/types/Strike";
export * from "~/types/User";
export * from "~/types/Gallery";
export * from "~/types/Toddel";
export * from "~/types/Wiki";
export * from "~/types/Order";
export * from "~/types/UserBio";
export * from "~/types/Feedback";

export type Reaction = {
  content_type: string;
  emoji: string;
  object_id: number;
  reaction_id: string;
  user?: Pick<UserBase, "user_id" | "first_name" | "last_name" | "image">;
};

export type ReactionMutate = Pick<Reaction, "emoji" | "content_type" | "object_id">;

export type Emoji = {
  emoji: string;
  count: number;
};
