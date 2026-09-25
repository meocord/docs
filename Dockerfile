# syntax=docker/dockerfile:1
ARG BUN_IMAGE=oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895
ARG BUN_SLIM_IMAGE=oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61

FROM ${BUN_IMAGE} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM ${BUN_IMAGE} AS builder
WORKDIR /app
# meo-canvas reads /etc/fonts/fonts.conf at startup, even though it registers its fonts by path.
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig-config && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM ${BUN_SLIM_IMAGE} AS runner
WORKDIR /app

# The Vulkan loader and what NVIDIA's driver links against: its Vulkan ICD is libGLX_nvidia, which
# needs the X, glvnd and EGL libraries, and the container toolkit mounts only the driver. Without a
# GPU, meo-canvas falls back to its CPU path. fontconfig-config is for its config file, as above.
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig-config \
    libegl1 \
    libglvnd0 \
    libvulkan1 \
    libx11-6 \
    libxext6 \
 && rm -rf /var/lib/apt/lists/*

ARG BUILD_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    BUILD_VERSION=${BUILD_VERSION} \
    PORT=3000 \
    UPSTREAM_PORT=3001

COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/scripts/csp-hash-proxy.mjs /app/scripts/csp-proxy-server.mjs /app/scripts/csp-hash.mjs /app/scripts/process-tree.mjs ./

USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# The proxy is PID 1 and supervises Next on UPSTREAM_PORT, bound to loopback.
CMD ["bun", "csp-hash-proxy.mjs"]
