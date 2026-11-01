FROM rust:1.89.0-bookworm AS rust-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
RUN cargo build --locked --release --workspace

FROM rust:1.89.0-bookworm AS wasm-tools
WORKDIR /app
COPY --from=node:24.22.2-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY scripts/wasm-bootstrap.mjs scripts/wasm-binaryen-tools.mjs ./scripts/
COPY scripts/binaryen ./scripts/binaryen
RUN node scripts/wasm-bootstrap.mjs

FROM wasm-tools AS wasm-builder
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
COPY scripts/wasm-build.mjs scripts/wasm-verify.mjs scripts/wasm-jspi-adapter.mjs scripts/wasm-portable-adapter.mjs scripts/wasm-portable-types.mjs scripts/wasm-portable-metadata.mjs scripts/wasm-asyncify-bounds.mjs scripts/wasm-asyncify-runtime.mjs scripts/wasm-portable-build.mjs scripts/wasm-binaryen-tools.mjs ./scripts/
COPY scripts/binaryen ./scripts/binaryen
COPY src/audio/live ./src/audio/live
COPY src/audio/analysisV1.ts ./src/audio/analysisV1.ts
COPY src/generated/analysis-wasm ./src/generated/analysis-wasm
RUN cargo fetch --locked --target wasm32-unknown-unknown \
  && node scripts/wasm-build.mjs --check

FROM node:24.22.2-bookworm-slim AS node-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --engine-strict
COPY index.html tsconfig*.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates/fretbloom-analysis ./crates/fretbloom-analysis
COPY crates/fretbloom-wasm ./crates/fretbloom-wasm
COPY scripts/wasm-bootstrap.mjs scripts/wasm-build.mjs scripts/wasm-verify.mjs scripts/wasm-jspi-adapter.mjs scripts/wasm-portable-adapter.mjs scripts/wasm-portable-types.mjs scripts/wasm-portable-metadata.mjs scripts/wasm-asyncify-bounds.mjs scripts/wasm-asyncify-runtime.mjs scripts/wasm-portable-build.mjs scripts/wasm-binaryen-tools.mjs ./scripts/
COPY scripts/binaryen ./scripts/binaryen
COPY --from=wasm-builder /app/src/generated/analysis-wasm ./src/generated/analysis-wasm
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24.22.2-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates ffmpeg python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY scripts/setup-youtube.mjs ./scripts/setup-youtube.mjs
COPY scripts/setup-separator.mjs scripts/separate-guitar.py scripts/separator-requirements.lock ./scripts/
RUN node scripts/setup-youtube.mjs && node scripts/setup-separator.mjs
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package.json ./package.json
COPY server ./server
COPY scripts/start-production.mjs ./scripts/start-production.mjs
COPY --from=rust-builder /app/target/release/fretbloom-backend ./target/release/fretbloom-backend
ENV HOST=0.0.0.0 PORT=4173 NODE_ENV=production
ENV FRETBLOOM_ANALYSIS_HOST=127.0.0.1 FRETBLOOM_ANALYSIS_PORT=5210
EXPOSE 4173
USER node
CMD ["node", "scripts/start-production.mjs"]
