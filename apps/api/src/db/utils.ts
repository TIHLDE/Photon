import { sql } from "drizzle-orm";
import { uuid } from "drizzle-orm/pg-core";

export const uuidv7 = () => uuid("id").primaryKey().default(sql`uuidv7()`);
