# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f docker/web.Dockerfile .
FROM node:20-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @mrdash/shared build && pnpm --filter @mrdash/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1
