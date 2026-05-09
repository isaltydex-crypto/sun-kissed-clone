#!/usr/bin/env bash
# Generate AVIF + WebP variants and responsive widths for all images
# in src/assets and public/assets.
#
# Requires: ImageMagick 7 (magick) and cwebp/avifenc, OR `sharp-cli` via npx.
# Easiest route on a fresh Mac/Linux:
#     brew install imagemagick libavif webp        # or apt equivalents
#
# Naming output expected by <ResponsiveImage>:
#     foo.jpg  ->  foo.avif, foo.webp,
#                  foo-480.webp, foo-768.webp, foo-1200.webp, foo-1920.webp
#                  foo-480.avif, foo-768.avif, foo-1200.avif, foo-1920.avif
set -euo pipefail

WIDTHS=(480 768 1200 1920)
DIRS=("${1:-src/assets}" "${2:-public}")

for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS= read -r -d '' src; do
    base="${src%.*}"
    echo "Optimising: $src"
    # Full-size AVIF + WebP
    magick "$src" -strip -quality 78 "${base}.webp" 2>/dev/null || true
    magick "$src" -strip -quality 55 "${base}.avif" 2>/dev/null || true
    # Responsive widths
    for w in "${WIDTHS[@]}"; do
      magick "$src" -strip -resize "${w}x>" -quality 78 "${base}-${w}.webp" 2>/dev/null || true
      magick "$src" -strip -resize "${w}x>" -quality 55 "${base}-${w}.avif" 2>/dev/null || true
    done
  done < <(find "$dir" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) ! -iname '*-[0-9]*' -print0)
done

echo "Done. Use <ResponsiveImage src=\"/assets/foo.jpg\" alt=\"...\" /> in components."
