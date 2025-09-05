import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";

export const mockTable = pgTable("mock_table", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }),
    value: integer("value"),
});
