import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

import { legacyRouteRules } from "./src/legacy-routes";

const config = defineConfig({
    resolve: {
        tsconfigPaths: true,
        // tslib 1.14.1 (pulled in transitively by @posthog/react) ships a UMD
        // build. rolldown's CJS→ESM interop tree-shakes its module body away via
        // the `@__PURE__` hint, so helpers like `__extends` are `undefined` at
        // runtime and SSR crashes ("Cannot destructure property '__extends'").
        // Point tslib at its ESM entry so it's consumed as real ES exports.
        alias: [{ find: /^tslib$/, replacement: "tslib/tslib.es6.js" }],
    },
    plugins: [
        devtools(),
        // On Vercel, Nitro externalizes React but its static tracer misses the
        // SSR runtime's raw `require("react")`, so React is absent from the
        // serverless bundle ("Cannot find module 'react'"). Force it to be traced.
        nitro({
            traceDeps: ["react", "react-dom"],
            // Serverside 301-er for de gamle tihlde.org-adressene, se
            // src/legacy-routes.ts.
            routeRules: legacyRouteRules,
        }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
    ],
});

export default config;
