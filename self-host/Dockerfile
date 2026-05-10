# ----------------------------------------------------------------------------
# peptivaLab — TanStack Start app (Node SSR build)
# Built from repo root: `docker compose build app`
# ----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Lockfile may be stale (Lovable regenerates it); fall back to `npm install`
# if `npm ci` fails so the build still succeeds on a fresh server.
RUN npm ci --include=dev || npm install --include=dev --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_PLAUSIBLE_DOMAIN=
ARG VITE_PLAUSIBLE_SRC=https://plausible.io/js/script.js
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_PLAUSIBLE_DOMAIN=$VITE_PLAUSIBLE_DOMAIN
ENV VITE_PLAUSIBLE_SRC=$VITE_PLAUSIBLE_SRC
ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=1536
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Swap to the Node-target vite config (equivalent of apply-patch.sh, but
# without needing node/npm which aren't in the bun-alpine image).
RUN if [ ! -f vite.config.editor.ts ]; then \
      mv vite.config.ts vite.config.editor.ts && \
      cp self-host/vite.config.node.ts vite.config.ts; \
    fi
RUN npm run build && \
    OUTPUT_ROOT="" && \
    for dir in .output dist; do \
      if [ -d "$dir" ]; then OUTPUT_ROOT="$dir"; break; fi; \
    done && \
    test -n "$OUTPUT_ROOT" && \
    SERVER_ENTRY="$(find "$OUTPUT_ROOT" -maxdepth 4 -type f \( -name 'index.mjs' -o -name 'index.js' -o -name 'server.mjs' -o -name 'server.js' \) | sort | head -n 1)" && \
    test -n "$SERVER_ENTRY" && \
    mkdir -p /app/runtime && \
    cp -R "$OUTPUT_ROOT" /app/runtime/ && \
    printf '#!/bin/sh\nset -e\nexec node "%s"\n' "$SERVER_ENTRY" > /app/runtime/start-server.sh && \
    chmod +x /app/runtime/start-server.sh || \
    (echo "ERROR: Node SSR build did not create a runnable server entry" && \
     echo "Build output folders found:" && \
     find .output dist -maxdepth 4 -type f -print 2>/dev/null || true && \
     exit 1)

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/runtime ./
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json* ./
# The TanStack Start bundle still requires some packages (e.g. h3-v2) at
# runtime instead of inlining them, so we need a node_modules tree alongside
# the dist output. Install production deps only to keep the image small.
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts || \
    npm install --omit=dev --no-audit --no-fund --ignore-scripts --legacy-peer-deps
EXPOSE 3000
CMD ["./start-server.sh"]
