import { varchar, pgTableCreator, uuid, text } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { event } from "./event";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `payment_${name}`);

export const order = pgTable("order", {
    id: uuid("id").primaryKey().defaultRandom(),
    vippsOrderId: varchar("vipps_order_id", { length: 32 }).notNull(),
    vippsOrderStatus: varchar("status", { length: 128 }).notNull(),
    vippsPaymentUrl: varchar("vipps_payment_url", { length: 512 }),
    // Nullable because event might be deleted, but we want to keep the order record
    // Future possibility of ordering other things than events
    eventId: uuid("event_id").references(() => event.id, {
        onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
});
