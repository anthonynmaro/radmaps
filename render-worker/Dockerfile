FROM node:20-slim

# Install Chromium and required system libraries for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    libgl1-mesa-dri \
    libegl1 \
    libgles2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip bundled Chrome download and use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY render-worker/package*.json ./
RUN npm install

# Bundle utils/mapStyle.ts into mapStyle.js (all presets, type-erased)
COPY utils/mapStyle.ts ./mapStyle.src.ts
COPY types/index.ts ./types.ts
RUN npx esbuild mapStyle.src.ts --bundle --platform=node --format=esm --outfile=mapStyle.js \
    && rm mapStyle.src.ts types.ts

# Prune dev dependencies after the build step
RUN npm prune --omit=dev

COPY render-worker/index.js ./

EXPOSE 8080
CMD ["node", "index.js"]
