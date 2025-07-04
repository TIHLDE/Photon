import { defineConfig } from "prisma/config";
import path from "node:path";
import { config } from "dotenv";

config();

export default defineConfig({
    earlyAccess: true,
    schema: path.join("prisma", "schema"),
});
