# Multi-stage build for the S-Lab HRMS web app.

# Official Docker "node" image via the AWS public mirror (avoids Docker Hub rate limits).
FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Full install + build. Also used as the "migrate" image (has the Prisma CLI and tsx).
FROM base AS builder
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV NEXT_TELEMETRY_DISABLED=1 APP_VERSION=$APP_VERSION
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

# Small runtime image.
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
