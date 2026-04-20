# Kvark — Agent Guide

This document defines the rules for AI agents (and humans) contributing to the Kvark frontend. It is intentionally strict about styling and component composition. Read it before writing code.

## Stack

- **Framework**: TanStack Start (React 19) with TanStack Router
- **Data**: TanStack Query (+ SSR integration via `@tanstack/react-router-ssr-query`)
- **Forms**: TanStack Form
- **Tables**: TanStack Table
- **API Client**: `@tihlde/sdk` (workspace package)
- **UI Kit**: `@tihlde/ui` (workspace package — ShadCN-based)
- **Styling**: Tailwind CSS v4 (layout-only in this app)
- **Auth**: Better Auth
- **Language**: TypeScript (strict)

## Core Rules

### 1. UI comes from `@tihlde/ui`

**All visual components MUST come from `@tihlde/ui`.** This app is part of a monorepo UI strategy where design decisions live in one place.

- Do not reinvent buttons, inputs, dialogs, cards, badges, tooltips, etc.
- If a ShadCN primitive is missing from `@tihlde/ui`, add it there — not here.
- Import from the package, never copy component source into this app.

```tsx
// GOOD
import { Button, Card, Input } from "@tihlde/ui";

// BAD — do not hand-roll styled primitives in this app
function MyButton() {
    return <button className="bg-blue-500 px-4 py-2 rounded">...</button>;
}
```

### 2. Tailwind is for **layout only**

This is the most important rule in this file. Violating it defeats the purpose of the shared UI package.

**Allowed Tailwind utilities:**

- Flex / grid: `flex`, `grid`, `flex-col`, `grid-cols-*`, `items-*`, `justify-*`, `place-*`
- Spacing: `gap-*`, `space-*`, `p-*`, `m-*`
- Sizing: `w-*`, `h-*`, `min-*`, `max-*`, `size-*`
- Positioning: `relative`, `absolute`, `fixed`, `sticky`, `top-*`, `inset-*`, `z-*`
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Overflow / container: `overflow-*`, `container`, `mx-auto`

**Forbidden in this app (belongs in `@tihlde/ui`):**

- Colors: `bg-*`, `text-*` (color), `border-*` (color), `ring-*`, `shadow-*`
- Borders / radii as decoration: `border`, `rounded-*`
- Any visual polish

If you find yourself writing a color or typography utility, **stop** — the right move is either to use an existing `@tihlde/ui` component or to add/extend one there.

### 3. Reusable local components

If a composition will appear more than once, extract it into `src/components/`.

- Local components may compose `@tihlde/ui` primitives and use layout-only Tailwind.
- They still may not introduce colors, typography, or decorative styling.
- Name files in kebab-case; export components in PascalCase.
- Keep them **dumb** (see rule 4).

### 4. Components are dumb

Presentation components MUST NOT:

- Fetch data (no `useQuery`, no `fetch`, no SDK calls inside)
- Mutate data (no `useMutation` inside)
- Read from global stores beyond trivial UI state
- Know about routes, auth state, or the network

They receive everything they render via props and emit events via callbacks. Fetching, mutating, and orchestration happen in **route components** or purpose-built container components.

```tsx
// GOOD — dumb presentation component
type EventCardProps = {
    title: string;
    startsAt: Date;
    onRegister: () => void;
};

export function EventCard({ title, startsAt, onRegister }: EventCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <time>{format(startAt, "PPP")}</time>
                <Button onClick={onRegister}>Register</Button>
            </CardContent>
        </Card>
    );
}
```

### 5. Suspense + skeletons everywhere

Pair TanStack Router and TanStack Query with Suspense aggressively.

- Use `useSuspenseQuery` for data that a route/section needs to render.
- Wrap data-dependent UI sub-trees in `<Suspense fallback={...}>`.
- Fallbacks must be **skeletons from `@tihlde/ui`** (preferred) or a spinner — never a blank screen, never ad-hoc gray boxes.
- Prefer multiple small Suspense boundaries over one page-level boundary so fast sections render immediately.

```tsx
<Suspense fallback={<EventListSkeleton />}>
    <EventList />
</Suspense>
```

### 6. Data layer

- All server data goes through `@tihlde/sdk`, wrapped in TanStack Query.
- Define query options (`queryOptions({ queryKey, queryFn })`) colocated with the feature under `src/api/` so they are reusable between loaders and components.
- Mutations invalidate the relevant query keys; do not manually edit cache unless there is a clear reason.
- Never call the SDK directly inside a dumb component.

## Directory Layout

```
src/
├── api/            # queryOptions + mutation helpers wrapping @tihlde/sdk
├── components/     # reusable local components (dumb, compose @tihlde/ui)
├── integrations/   # third-party glue (posthog, query client, etc.)
├── lib/            # pure utilities (no React, no network)
├── routes/         # TanStack Router file-based routes (containers live here)
├── router.tsx
└── styles.css
```

Route files are the containers: they load data, manage Suspense boundaries, wire mutations, and pass plain props into dumb components.

## Forms

- Use TanStack Form.
- Inputs, labels, and error displays come from `@tihlde/ui`.
- Validate with Zod schemas; share schemas with the backend when possible.
-

## Tables

- Use TanStack Table for logic; render cells using `@tihlde/ui` primitives.
- Extract column definitions next to the feature, not inline in the route, once they grow past trivial.
- use the `colummDefinitionHelper` where applicable to get typesafety and avoid typos.

## Checklist Before Committing

1. No color, typography, border, shadow, or animation classes added in this app.
2. Any new visual primitive lives in `@tihlde/ui`, not here.
3. New reusable composition? Extracted into `src/components/`.
4. Components receive data via props; fetching happens in routes/containers.
5. Every async boundary has a skeleton/spinner fallback.
6. `bun run typecheck`, `bun run lint`, and `bun run format` pass.

## When In Doubt

- Missing a component? → add it to `@tihlde/ui`.
- Need to style something? → you probably don't; use a `@tihlde/ui` component instead.
- Tempted to fetch inside a card/list/row component? → lift it to the route.
- Unsure what to show while loading? → a `@tihlde/ui` skeleton that mirrors the final layout.

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "working on the TanStack Start app shell, router setup, or overall app wiring"
    load: "node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
  - task: "working on TanStack Start React Server Components or RSC caching"
    load: "node_modules/@tanstack/react-start/skills/react-start/server-components/SKILL.md"
  - task: "working on generated file-based routes, route tree generation, or router bundler setup"
    load: "node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"
  - task: "working on TanStack Devtools Vite setup, source inspection, or devtools console piping"
    load: "node_modules/@tanstack/devtools-vite/skills/devtools-vite-plugin/SKILL.md"
  - task: "working on core TanStack Router structure, route trees, or root route context"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x router-core
  - task: "working on route auth, redirects, or protected pages"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep auth-and-guards
  - task: "working on route code splitting, lazy routes, or split route APIs"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep code-splitting
  - task: "working on route loaders, preloading, or query-backed data loading"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep data-loading
  - task: "working on navigation, links, redirects, or preload behavior"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep navigation
  - task: "working on not found handling, error boundaries, or route masking"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep not-found-and-errors
  - task: "working on path params, dynamic segments, or route param parsing"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep path-params
  - task: "working on search params, filters, or URL-driven state"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep search-params
  - task: "working on route SSR, streaming, head metadata, or document rendering"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x ssr
  - task: "working on typed route APIs, route inference, or Link/useNavigate type safety"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep type-safety
  - task: "working on TanStack Devtools app setup, shell config, or plugin registration"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-app-setup
  - task: "working on TanStack Devtools marketplace publishing"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-marketplace
  - task: "working on a TanStack Devtools plugin panel"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-plugin-panel
  - task: "working on production handling for TanStack Devtools"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-production
  - task: "working on bidirectional app and devtools events"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-bidirectional
  - task: "working on a typed TanStack Devtools event client"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x devtools-event-client
  - task: "working on instrumenting code for TanStack Devtools events"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep devtools-instrumentation
  - task: "working on TanStack Start core setup, entry points, or routeTree generation"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x start-core
  - task: "working on deployment targets, SSR strategy, or prerendering"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep deployment
  - task: "working on server/client boundaries, auth session fetching, or environment-specific code"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep execution-model
  - task: "working on TanStack Start middleware, request context, or cross-cutting server logic"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x middleware
  - task: "working on TanStack Start server functions, useServerFn, or validated server mutations"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep server-functions
  - task: "working on TanStack Start server routes or API handlers"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep server-routes
  - task: "working on TanStack Start server runtime internals, request utilities, or session helpers"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep -x start-server-core
  - task: "working on virtual or programmatic route trees instead of file-based routes"
    # To load this skill, run: bunx @tanstack/intent@latest list | grep virtual-file-routes
  - task: "giving feedback on TanStack intent skill usage"
    load: "node_modules/@tanstack/intent/meta/feedback-collection/SKILL.md"
<!-- intent-skills:end -->
