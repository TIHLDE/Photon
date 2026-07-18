import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// On Vercel, force Nitro's `vercel` preset so the build emits `.vercel/output`
// (Build Output API) instead of the default `node-server` output. Without this,
// Vercel treats the app as a static Vite build and fails looking for `dist`.
const nitroConfig = process.env.VERCEL ? { config: { preset: "vercel" } } : {};

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [
        devtools(),
        nitro(nitroConfig),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
    ],
});

export default config;
