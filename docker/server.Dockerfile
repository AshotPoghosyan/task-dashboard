# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f docker/server.Dockerfile .
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# Full workspace with build output. Also used (target: build) for one-off migrate/seed jobs.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @mrdash/shared build && pnpm --filter @mrdash/server build
CMD ["pnpm", "db:migrate:deploy"]

# Production-only dependencies for the server, plus the Prisma client generated in `build`.
FROM build AS deploy
RUN pnpm --filter @mrdash/server deploy --prod --ignore-scripts /out \
  && src=$(dirname "$(dirname "$(readlink -f apps/server/node_modules/@prisma/client)")")/.prisma \
  && dst=$(dirname "$(dirname "$(readlink -f /out/node_modules/@prisma/client)")")/.prisma \
  && rm -rf "$dst" && cp -r "$src" "$dst"

FROM base AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=deploy --chown=node:node /out/ ./
COPY --from=build --chown=node:node /repo/apps/server/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]
