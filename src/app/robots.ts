import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/compte", "/admin", "/mes-cours", "/apprendre", "/progression", "/activer/", "/reinitialiser/", "/installation"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
