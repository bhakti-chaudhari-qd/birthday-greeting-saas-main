# Debian-based (not Alpine) - @napi-rs/canvas and ffmpeg-static ship
# glibc-linked prebuilt binaries and don't work under musl.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Prisma's query engine needs libssl to be present and detectable at
# `prisma generate` time (during postinstall) - bookworm-slim doesn't ship
# it by default and Prisma silently falls back to a guessed engine target.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# npm's install-scripts trust gate blocks postinstall for packages not
# pre-approved in package.json#allowScripts (only ffmpeg-static is there) -
# approve the rest so sharp/esbuild/prisma actually build, then let the
# postinstall (prisma generate) run for real.
RUN npm ci \
  && npm install-scripts approve sharp esbuild @prisma/client @prisma/engines prisma unrs-resolver \
  && npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Same reason as the deps stage: the query engine binary needs libssl at
# runtime, not just at generate time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
CMD ["node", "server.js"]
