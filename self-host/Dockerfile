# ----------------------------------------------------------------------------
# peptivaLab — TanStack Start app (Node SSR build)
# Built from repo root: `docker compose build app`
# ----------------------------------------------------------------------------
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* package-lock.json* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1.1-alpine AS build
WORKDIR /app
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Apply the self-host build patch (swap Cloudflare → Node target)
RUN sh ./self-host/apply-patch.sh
RUN bun run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
