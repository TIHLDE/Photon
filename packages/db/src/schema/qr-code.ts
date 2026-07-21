import { relations } from "drizzle-orm";
import { pgTableCreator, text, uuid, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `qrcode_${name}`);

/**
 * A QR code a member generated for themselves.
 *
 * We store the payload, not an image — the code is rendered client side, so a
 * member can re-download it at any size without us keeping a file around.
 */
export const qrCode = pgTable("qr_code", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    content: text("content").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
});

export const qrCodeRelations = relations(qrCode, ({ one }) => ({
    owner: one(user, {
        fields: [qrCode.userId],
        references: [user.id],
    }),
}));

export type QRCode = typeof qrCode.$inferSelect;
