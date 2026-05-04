# RadMaps render worker v4
# ─────────────────────────────────────────────────────────────────────────────
# MapLibre Native + Sharp compositor + Postgres queue consumer.
# No Chromium, no browser fallback in v1 — every preset renders Native.
# If a future preset needs a fallback, the existing render-worker/ Puppeteer
# service is the target (HTTP call); no new Chromium image required.
#
# Native deps mirror render-worker-native-spike/Dockerfile:
#   • libgl1-mesa-glx / libgles2-mesa / libegl1 — software GL for Native
#   • libvips-dev                              — sharp
#   • fontconfig + fonts-dejavu-core            — fontconfig backbone
#
# Fonts: the entire fonts/ directory from the repo root is copied into
# /usr/share/fonts/radmaps and registered with fontconfig. The set of
# files there is the source of truth (see utils/render/fontRegistry.ts);
# scripts/validate-fonts.ts in CI keeps this in sync.
#
# Tile cache lives at /app/tile-cache; mount a persistent Railway volume
# there for warm cache across deploys.

FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1-mesa-glx \
      libgles2-mesa \
      libegl1 \
      libx11-6 \
      libvips-dev \
      fontconfig \
      fonts-dejavu-core \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Build stage ────────────────────────────────────────────────────────────
FROM base AS build

# Foundation utilities live in the parent repo; build context must be the
# repo root so we can read ../utils/* and ../types/*.
COPY render-worker-v4/package*.json ./
RUN npm install

COPY render-worker-v4/ ./
COPY utils/ ./utils-src/
COPY types/ ./types-src/

# Repoint the path aliases at the copied sources for the bundle.
RUN node -e "const fs=require('fs');const p='./tsconfig.json';const t=JSON.parse(fs.readFileSync(p));t.compilerOptions.paths={'~/types':['./types-src/index'],'~/*':['./*']};fs.writeFileSync(p,JSON.stringify(t,null,2));"

RUN npm run build

# Prune devDependencies for the runtime image.
RUN npm prune --omit=dev

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM base AS runtime

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Self-hosted fonts (Oswald, Bebas Neue, etc.) — same TTFs the editor
# serves via @font-face from the registry so editor and worker emit
# byte-identical typography. Single source of truth: fonts/ at repo root.
COPY fonts/ /usr/share/fonts/radmaps/
RUN fc-cache -f /usr/share/fonts/radmaps/ && \
    fc-list | grep -i 'oswald\|bebas\|dm sans\|work sans' | head -5

# Tile cache directory (mount a Railway volume here in production).
RUN mkdir -p /app/tile-cache

EXPOSE 3002
CMD ["node", "dist/index.js"]
