FROM oven/bun:1-alpine AS base
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

FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup -S -g 1001 hono && adduser -S -u 1001 -G hono hono
USER hono

COPY --from=base /app .

CMD ["bun", "run", "--filter=@photon/api", "start"]
