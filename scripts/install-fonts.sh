#!/bin/bash
# Local-dev font installer.
#
# Symlinks the repo's fonts/*.ttf into the OS font directory so that
# Sharp/libvips (used by the render-worker-v4 harness on the developer's
# machine) can find them.
#
# CoreText quirk on macOS: ~/Library/Fonts/ subdirectories are NOT
# scanned. Fonts must live at the root of ~/Library/Fonts/ to be visible
# to NSFont / CoreText / Pango-CoreText. We use a `radmaps-` filename
# prefix so it's still trivial to identify and remove these later.
#
# Linux fontconfig DOES recurse, so we keep the friendlier subdirectory
# layout there.
#
# Idempotent — safe to re-run after `git pull` adds new font files.
#
# Production deployment: render-worker-v4/Dockerfile copies fonts/ to
# /usr/share/fonts/radmaps and runs `fc-cache -f`. Linux fontconfig
# recurses into that path. This script is NOT used in production.

set -euo pipefail
cd "$(dirname "$0")/.."

REPO_FONTS="$(pwd)/fonts"
PREFIX="radmaps-"

OS="$(uname -s)"
case "$OS" in
  Darwin)
    DEST="$HOME/Library/Fonts"          # MUST be root, not a subdir
    USE_PREFIX=1
    ;;
  Linux)
    DEST="$HOME/.local/share/fonts/RadMaps"
    USE_PREFIX=0
    mkdir -p "$DEST"
    ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Clean prefixed entries from prior runs (so renamed font files don't
# accumulate stale copies on disk).
if [ "$USE_PREFIX" = "1" ]; then
  find "$DEST" -maxdepth 1 \( -name "${PREFIX}*" \) -delete 2>/dev/null || true
fi

count=0
for src in "$REPO_FONTS"/*.ttf "$REPO_FONTS"/*.otf; do
  [ -f "$src" ] || continue
  base="$(basename "$src")"
  name="${USE_PREFIX:+$PREFIX}$base"
  dst="$DEST/$name"
  # macOS CoreText does NOT follow symlinks for font registration —
  # it ignores them entirely. Copy the file (cheap; ~100 KB each).
  # Skip if destination is already byte-identical.
  if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
    continue
  fi
  cp -f "$src" "$dst"
  count=$((count + 1))
done

# Refresh fontconfig cache (Linux uses this; macOS CoreText auto-detects
# but fc-cache is harmless on macOS too).
if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$DEST" >/dev/null 2>&1 || true
fi

# Force macOS to re-scan ~/Library/Fonts/ so newly installed files are
# visible to Pango-CoreText immediately. Without this, `cp` to that
# directory does NOT trigger CoreText to register the new file — it'll
# wait until the next login or fontd restart.
if [ "$OS" = "Darwin" ]; then
  killall fontd >/dev/null 2>&1 || true
fi

echo "✅ installed/refreshed $count font(s) → $DEST"
total=$(find "$DEST" -maxdepth 1 -name "${USE_PREFIX:+${PREFIX}}*.ttf" 2>/dev/null | wc -l | tr -d ' ')
echo "   $total total .ttf files registered"
