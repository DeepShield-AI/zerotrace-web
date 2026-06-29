# =============================================================================
# zerotrace-web — Pre-compiled binary, no Docker Hub required
#
# Build on host first:
#   cd zerotrace-web/backend
#   cargo build --release   (or use the cached builder image)
#
# Then build image:
#   docker build -t zerotrace-web:latest .
# =============================================================================
FROM alpine:latest

RUN apk update && apk add --no-cache tzdata ca-certificates

WORKDIR /app
COPY target/x86_64-unknown-linux-musl/release/zerotrace-web /app/zerotrace-web
COPY migrations/ /app/migrations/
COPY agent-installer/ /app/agent-installer/
COPY frontend-dist/ /app/frontend/

ENV STATIC_DIR=/app/frontend
ENV BINARIES_DIR=/app/agent-installer/binaries
ENV SCRIPTS_DIR=/app/agent-installer/scripts

EXPOSE 3001

CMD ["/app/zerotrace-web"]
