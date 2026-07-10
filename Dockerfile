# Multi-stage: build dependencies in one layer, ship only what runs.

FROM node:20-alpine AS deps

WORKDIR /app

# Copied before the source so a source edit does not invalidate the npm layer.
COPY package.json package-lock.json ./

# `npm ci` installs exactly the lockfile. `--omit=dev` drops vitest, eslint,
# nodemon, and pino-pretty — none of which may run in production.
RUN npm ci --omit=dev


FROM node:20-alpine AS runtime

# Not secrets, and correct to bake in. Everything environment-specific
# (SUPABASE_*, LEMON_SQUEEZY_*, DASHBOARD_ORIGINS) is injected at runtime by
# the platform's secret manager, never with ARG or ENV at build time — image
# history is readable.
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY src ./src

# The node:alpine images ship an unprivileged `node` user. A container process
# that does not need root must not have it.
USER node

EXPOSE 3000

# Liveness, not readiness: /health touches no external service, so a Supabase
# outage will not restart an otherwise healthy container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# `node server.js` directly, not `npm start`: npm swallows SIGTERM, and the
# graceful shutdown handler would never run.
CMD ["node", "server.js"]
