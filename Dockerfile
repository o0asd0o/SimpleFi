# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:22-alpine AS frontend
RUN npm install -g pnpm@11
WORKDIR /build
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# ── Stage 2: Build backend ──────────────────────────────────
FROM golang:1-alpine AS backend
WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags "-X main.buildVersion=$(date +%s)" -o /simplefi .

# ── Stage 3: Runtime ────────────────────────────────────────
FROM alpine:3
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend /simplefi .
COPY --from=frontend /build/dist ./dist

ENV STATIC_DIR=./dist
ENV DB_PATH=/app/data/data.db

EXPOSE 8080
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/api/health || exit 1

CMD ["./simplefi"]
