#!/bin/bash
# =============================================================================
# Prepare Docker build context for zerotrace-web.
#
# Collects all host-compiled artifacts into the build/ directory so
# the Dockerfile can COPY them without internet access.
#
# Usage:
#   ./prepare-docker-build.sh
#   docker build -t zerotrace-web:latest .
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

echo "==> Cleaning build/ directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/libs" "$BUILD_DIR/static" "$BUILD_DIR/migrations" "$BUILD_DIR/agent-installer"

# --- Backend binary ---
echo "==> Checking backend binary..."
BINARY="$SCRIPT_DIR/backend/target/release/zerotrace-web"
if [ ! -f "$BINARY" ]; then
    echo "ERROR: Backend binary not found. Run: cd backend && cargo build --release"
    exit 1
fi
cp "$BINARY" "$BUILD_DIR/zerotrace-web"
echo "    Binary: $(ls -lh "$BINARY" | awk '{print $5}')"

# --- glibc runtime libraries ---
echo "==> Collecting glibc runtime libraries..."
for lib in libgcc_s.so.1 libm.so.6 libc.so.6 libpthread.so.0 libdl.so.2 librt.so.1 libresolv.so.2 libunwind.so.8 libunwind-x86_64.so.8 liblzma.so.5 libzstd.so.1; do
    cp -L "/usr/lib/x86_64-linux-gnu/$lib" "$BUILD_DIR/libs/" 2>/dev/null || {
        cp -L "/lib/x86_64-linux-gnu/$lib" "$BUILD_DIR/libs/" 2>/dev/null
    } || true
done
cp -L "/lib64/ld-linux-x86-64.so.2" "$BUILD_DIR/ld-linux-x86-64.so.2" 2>/dev/null || true
echo "    Libs size: $(du -sh "$BUILD_DIR/libs" | awk '{print $1}')"

# --- Frontend dist ---
echo "==> Checking frontend dist..."
DIST="$SCRIPT_DIR/frontend/dist"
if [ ! -d "$DIST" ]; then
    echo "ERROR: Frontend dist not found. Run: cd frontend && npm run build"
    exit 1
fi
cp -r "$DIST/"* "$BUILD_DIR/static/"
echo "    Dist size: $(du -sh "$DIST" | awk '{print $1}')"

# --- Migrations ---
cp "$SCRIPT_DIR/backend/migrations/"*.sql "$BUILD_DIR/migrations/"
echo "    Migrations: $(ls "$BUILD_DIR/migrations/" | wc -l) files"

# --- Agent installer ---
if [ -d "$SCRIPT_DIR/backend/agent-installer" ]; then
    cp -r "$SCRIPT_DIR/backend/agent-installer/"* "$BUILD_DIR/agent-installer/"
    echo "    Agent installer: $(du -sh "$SCRIPT_DIR/backend/agent-installer" | awk '{print $1}')"
fi

echo ""
echo "✅ Build context ready at $BUILD_DIR"
echo "   Total size: $(du -sh "$BUILD_DIR" | awk '{print $1}')"
echo ""
echo "Now run: docker build -t zerotrace-web:latest ."
