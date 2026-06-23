# =============================================================================
# Stage 1: Build Rust binary
# =============================================================================
FROM rust:alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./

# Cache dependencies by building with dummy main
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null; true
RUN rm -rf src

# Copy real source
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY agent-installer/ ./agent-installer/

# Build real binary
RUN cargo build --release

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM alpine:latest

RUN apk update && apk add --no-cache tzdata ca-certificates

WORKDIR /app
COPY --from=builder /app/target/release/zerotrace-web /app/zerotrace-web
COPY --from=builder /app/migrations/ /app/migrations/
COPY --from=builder /app/agent-installer/ /app/agent-installer/

EXPOSE 3001

CMD ["/app/zerotrace-web"]
