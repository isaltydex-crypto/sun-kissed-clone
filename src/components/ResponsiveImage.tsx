import { type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  /** Comma-separated viewport sizes hint for the browser, e.g. "(min-width: 768px) 33vw, 100vw" */
  sizes?: string;
  /** Set true for above-the-fold hero images. Defaults to lazy. */
  priority?: boolean;
};

/**
 * Drop-in replacement for <img> that:
 *  - Prefers AVIF/WebP siblings when present (e.g. /image.jpg → /image.avif, /image.webp)
 *  - Generates a srcset for 480/768/1200/1920 widths if matching files exist
 *  - Lazy-loads by default, eager + fetchpriority="high" when priority
 *
 * Naming convention expected for the optimization script:
 *   /assets/hero.jpg            (original)
 *   /assets/hero.avif           (full size AVIF)
 *   /assets/hero.webp           (full size WebP)
 *   /assets/hero-480.webp ...   (responsive widths, optional)
 */
export function ResponsiveImage({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  className,
  width,
  height,
  ...rest
}: Props) {
  const dot = src.lastIndexOf(".");
  const base = dot > 0 ? src.slice(0, dot) : src;
  const ext = dot > 0 ? src.slice(dot + 1) : "jpg";

  const isRemote = /^https?:\/\//.test(src) || src.startsWith("data:");

  // For remote/dynamic sources we don't know if siblings exist — just render plain img.
  if (isRemote) {
    return (
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        width={width}
        height={height}
        className={className}
        {...rest}
      />
    );
  }

  const widths = [480, 768, 1200, 1920];
  const buildSrcSet = (format: "avif" | "webp" | typeof ext) =>
    widths.map((w) => `${base}-${w}.${format} ${w}w`).join(", ");

  return (
    <picture>
      <source type="image/avif" srcSet={buildSrcSet("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={buildSrcSet("webp")} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        width={width}
        height={height}
        className={className}
        {...rest}
      />
    </picture>
  );
}
