import { sql } from "drizzle-orm";
import { uuid } from "drizzle-orm/pg-core";

export const uuidv7 = () =>
    uuid("id").primaryKey().default(sql`uuid_generate_v7()`);
