FROM node:22-alpine AS base

FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

# First install the dependencies (as they change less often)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN corepack enable
RUN pnpm install --frozen-lockfile

# Build the project
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 hono
RUN adduser --system --uid 1001 hono
USER hono

COPY --from=installer /app .

CMD node dist/index.js