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
ARG VITE_PLAUSIBLE_DOMAIN=
ARG VITE_PLAUSIBLE_SRC=https://plausible.io/js/script.js
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_PLAUSIBLE_DOMAIN=$VITE_PLAUSIBLE_DOMAIN
ENV VITE_PLAUSIBLE_SRC=$VITE_PLAUSIBLE_SRC
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Swap to the Node-target vite config (equivalent of apply-patch.sh, but
# without needing node/npm which aren't in the bun-alpine image).
RUN if [ ! -f vite.config.editor.ts ]; then \
      mv vite.config.ts vite.config.editor.ts && \
      cp self-host/vite.config.node.ts vite.config.ts; \
    fi
RUN bun run build && \
    test -f .output/server/index.mjs || \
    (echo "ERROR: Node SSR build did not create .output/server/index.mjs" && \
     echo "Build output folders found:" && \
     ls -la && \
     exit 1)

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
