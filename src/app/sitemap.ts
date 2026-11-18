import type { MetadataRoute } from "next";
import { PROGRAMS } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...PROGRAMS.map((p) => ({
      url: `${SITE_URL}/programmes/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: p.featured ? 0.9 : 0.8,
    })),
    { url: `${SITE_URL}/coaching`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
