FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY infra/ ./infra/

# Install dependencies
RUN bun install --frozen-lockfile

# Build the API
RUN bunx turbo build --filter=@photon/api

FROM oven/bun:1 AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 hono
RUN adduser --system --uid 1001 hono
USER hono

COPY --from=base /app .

CMD ["bun", "run", "apps/api/dist/index.js"]
