# Photon

Ny backend for NOK

![Static Badge](https://img.shields.io/badge/Language-Typescript-blue?logo=typescript)
![Static Badge](https://img.shields.io/badge/Website-NextJS-black?logo=nextdotjs)
![Static Badge](https://img.shields.io/badge/Server-Hono-orange?logo=hono)


## TypeScript configs

Use the presets in `packages/tsconfig` so each package uses the right settings.

- **Base**
  - `packages/tsconfig/base.json`: Shared strict baseline. Other presets extend this.

- **Node (no bundler)**
  - `packages/tsconfig/node/node.json`: For scripts/CLIs or servers run directly by Node/tsx. Uses ESM with `NodeNext` resolution and `types: ["node"]`.

- **Node (bundled app/service)**
  - `packages/tsconfig/node/bundler.json`: For Node code built with a bundler (tsup/esbuild). Uses ESM with `Bundler` resolution.

- **Node library**
  - `packages/tsconfig/node/library.json`: For Node libraries consumed via bundlers. If you need `.d.ts` output, add a `tsconfig.build.json` that enables declaration emit.

- **Next.js app**
  - `packages/tsconfig/web/nextjs.json`: For Next.js apps. `jsx: "preserve"` and the Next TypeScript plugin.

- **React web library**
  - `packages/tsconfig/web/react-library.json`: For React component libraries. `jsx: "react-jsx"`.

- **Browser library (no React)**
  - `packages/tsconfig/web/web-library.json`: For browser libraries that don’t use React.
