import { programPhoto } from "@/lib/catalog";
import { cn } from "cn";

/**
 * Pre-sized catalogue photo (`public/images/photos/<name>-{720,1280}.webp` + JPEG fallback).
 * A plain <picture> — the assets are already optimised, so no image optimiser round-trip.
 */
export function Photo({
  name,
  alt,
  sizes,
  position,
  eager,
  className,
}: {
  name: string;
  alt: string;
  sizes: string;
  position?: string;
  eager?: boolean;
  className?: string;
}) {
  const src = programPhoto({ photo: name });
  return (
    <picture>
      <source type="image/webp" srcSet={`${src.small} 720w, ${src.large} 1280w`} sizes={sizes} />
      <img
        src={src.fallback}
        alt={alt}
        width={1280}
        height={853}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("size-full object-cover", className)}
        style={position ? { objectPosition: position } : undefined}
      />
    </picture>
  );
}
