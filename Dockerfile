# =============================================================================
# zerotrace-web — Host-compiled: backend (Rust) + frontend (React) in one image
#
# Build on host first:
#   cd backend   && cargo build --release
#   cd frontend  && npm run build
#   ./prepare-docker-build.sh   # (copies binary + dist + libs into build/ dir)
#
# Then build image:
#   docker build -t zerotrace-web:latest .
# =============================================================================
FROM alpine:latest

# glibc runtime libraries (for Rust binary)
COPY build/libs/ /usr/lib/x86_64-linux-gnu/
COPY build/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2

# Application
COPY build/zerotrace-web /app/zerotrace-web

# Frontend static files
COPY build/static/ /app/static/

# Database migrations
COPY build/migrations/ /app/migrations/

# Agent installer
COPY build/agent-installer/ /app/agent-installer/

ENV STATIC_DIR=/app/static

EXPOSE 3001

CMD ["/app/zerotrace-web"]
