# Lucepress — Railway Dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# Deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# Prod deps only (optional, garde dev pour drizzle-kit si besoin)
# RUN pnpm prune --prod

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["pnpm", "start"]
