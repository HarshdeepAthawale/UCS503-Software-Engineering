# syntax=docker/dockerfile:1
#
# Thapar Nexus — production image.
#
# Alpine is safe here specifically because prisma/schema.prisma sets
# engineType = "client": queries run through the pure-WASM compiler with a JS
# `pg` driver adapter, so there is NO native query engine to link against and
# none of the usual musl/openssl grief applies (D-18).
#
# Node 22 to match .node-version and the `engines` range.

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# prisma/ must be present BEFORE npm ci: package.json has a `postinstall` that
# runs `prisma generate`, and without a schema that install fails.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── dev ──────────────────────────────────────────────────────────────────────
# Local development target, used by docker-compose.yml. Deliberately NOT the
# production image.
#
# Why a separate stage rather than running the production one locally: the
# production image pins NODE_ENV=production, and src/lib/env.ts then refuses to
# boot with ALLOW_INSECURE_COOKIES=true (B-05, and rightly so). But a container
# on http://localhost cannot store a Secure cookie, so a production build served
# over plain HTTP can never hold a session — nobody could log in. Development
# mode resolves that honestly instead of weakening the guard.
#
# Source is bind-mounted by compose; node_modules is kept as a volume so the
# mount does not shadow what was installed here for LINUX (the host's
# node_modules is built for a different platform).
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV NODE_ENV=development
EXPOSE 3000
CMD ["./node_modules/.bin/next", "dev", "-H", "0.0.0.0"]

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `output: "standalone"` is opt-in via this flag so the Vercel and Render builds
# are byte-for-byte what they are today. See next.config.ts.
ENV DOCKER_BUILD=1

# src/lib/env.ts validates at build time (it is evaluated while collecting page
# data). These are throwaway values that merely have to be VALID — no route is
# executed against them, and every one is replaced at runtime. A real secret
# here would be baked into a distributable layer.
#
# Passed inline to RUN rather than via ENV deliberately: ENV persists into the
# image config, where `docker inspect` shows it and Docker warns
# (SecretsUsedInArgOrEnv). Inline, they live only for this one command and
# never reach image metadata — so the pattern stays correct even if someone
# later swaps a placeholder for something real.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    JWT_ACCESS_SECRET="docker-build-placeholder-access-secret-32b" \
    JWT_REFRESH_SECRET="docker-build-placeholder-refresh-secret-32b" \
    ALLOW_INSECURE_COOKIES="false" \
    npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Never run the server as root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# The standalone bundle carries its own minimal node_modules, traced from the
# import graph. `public` and `.next/static` are NOT included in it and must be
# copied separately or every asset 404s.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Tracing follows `import`s, but the Prisma client loads its .wasm by PATH at
# runtime, so the tracer never sees it. Same reason next.config.ts carries
# outputFileTracingIncludes — without this, every query dies with
# ENOENT query_compiler_bg.wasm, which is exactly how it failed in production
# once already.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Migrations are NOT run on boot: several replicas starting at once would race,
# and a container should not hold schema authority. Run them as a deliberate
# step:  docker compose run --rm app npm run db:migrate:deploy
#
# Both halves are needed — the migration SQL under prisma/, and the runner under
# scripts/. Shipping only prisma/ fails with MODULE_NOT_FOUND on the runner.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
