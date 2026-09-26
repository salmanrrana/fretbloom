FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates ffmpeg python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN node scripts/setup-youtube.mjs \
  && npm run build \
  && npm prune --omit=dev --ignore-scripts

ENV HOST=0.0.0.0
ENV PORT=4173
ENV NODE_ENV=production

EXPOSE 4173

CMD ["node", "server/index.ts"]
