# Kvark — Agent Guide

This document defines the rules for AI agents (and humans) contributing to the Kvark frontend. It is intentionally strict about styling and component composition. Read it before writing code.

## Stack

- **Framework**: TanStack Start (React 19) with TanStack Router
- **Data**: TanStack Query (+ SSR integration via `@tanstack/react-router-ssr-query`)
- **Forms**: TanStack Form
- **Tables**: TanStack Table
- **API Client**: `typed-openapi` generated client from `@photon/codegen`
- **UI Kit**: `@tihlde/ui` (workspace package — ShadCN-based)
- **Styling**: Tailwind CSS v4 (theme tokens only; `@tihlde/ui` components are never restyled)
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

### 2. Don't restyle `@tihlde/ui` components

This is the most important rule in this file. Violating it defeats the purpose of the shared UI package. It is enforced by `@shadcn/lint` (rules in `apps/kvark/.oxlintrc.json`, run with `bun run lint`).

**`className` on a `@tihlde/ui` component may only set layout and spacing:**

- Flex / grid: `flex`, `grid`, `flex-col`, `grid-cols-*`, `items-*`, `justify-*`, `place-*`
- Spacing: `gap-*`, `space-*`, `p-*`, `m-*`
- Sizing: `w-*`, `h-*`, `min-*`, `max-*`, `size-*`
- Positioning: `relative`, `absolute`, `fixed`, `sticky`, `top-*`, `inset-*`, `z-*`
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Overflow / container: `overflow-*`, `container`, `mx-auto`

Color, typography, shape and effects on a component belong in a variant. If none fits, add one in `packages/ui`.

**Everywhere in this app:**

- Colors are theme tokens (`text-muted-foreground`, `bg-destructive`), never the raw palette (`bg-red-500`).
- Theme tokens such as `text-sm` or `text-muted-foreground` are fine on plain elements (`div`, `p`, `span`).
- No arbitrary values (`p-[13px]`), no inline `style`, and no classes Tailwind cannot generate.

### 3. Reusable local components

If a composition will appear more than once, extract it into `src/components/`.

- Local components compose `@tihlde/ui` primitives and follow rule 2: no restyling of those primitives, theme tokens only.
- Name files in kebab-case; export components in PascalCase.
- Keep them **dumb** (see rule 4).

### 4. Components are dumb

Presentation components MUST NOT:

- Fetch data (no `useQuery`, no `fetch`, no API client calls inside)
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

- All server data goes through `apiClient` from `#/api/api-client`, wrapped in TanStack Query. Types come from `@photon/codegen`; regenerate with `bun run codegen`.
- Define query options (`queryOptions({ queryKey, queryFn })`) colocated with the feature under `src/api/` so they are reusable between loaders and components.
- Mutations invalidate the relevant query keys; do not manually edit cache unless there is a clear reason.
- Never call the API client directly inside a dumb component.

### 7. Datoer og klokkeslett

- Alt vises i norsk tid. Bruk `formatOsloDate` / `formatOsloDateTime` fra `#/lib/date` — aldri `toLocale*` eller `new Intl.DateTimeFormat` direkte (oxlint stopper det).
- Trenger du en dato som verdi, ikke tekst: `formatInOslo` for date-fns-mønstre og `todayInOslo` som standardverdi i datovelgere.
- Grunnen er hydrering like mye som riktig tid: SSR-serveren står i UTC og nettleseren i `Europe/Oslo`, så en tidssoneløs formattering gir ulik HTML på de to sidene og React-feil #418.

## Directory Layout

```
src/
├── api/            # app-specific API configuration + queryOptions and mutations
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

1. No `@tihlde/ui` component restyled beyond layout and spacing, and no raw palette colors, arbitrary values or inline styles (`bun run lint` reports them).
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
