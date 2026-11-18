import type { Program } from "@/lib/catalog";
import { PHONE_TEL, SITE_NAME, SITE_URL, SLOGAN } from "@/lib/site";
import { FOUNDER } from "@/lib/content";

/** schema.org structured data (escaped so a « </script> » in content can't break out). */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const org = {
  "@type": "EducationalOrganization",
  name: SITE_NAME,
  slogan: SLOGAN,
  url: SITE_URL,
  logo: `${SITE_URL}/images/maelenglish-logo.png`,
  telephone: PHONE_TEL,
  founder: { "@type": "Person", name: FOUNDER.name, image: `${SITE_URL}/images/photos/${FOUNDER.photo}-1280.jpg` },
};

export function organizationJsonLd() {
  return { "@context": "https://schema.org", ...org };
}

export function courseJsonLd(p: Program) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: p.name,
    description: `${p.tagline}. ${p.summary}`,
    url: `${SITE_URL}/programmes/${p.slug}`,
    inLanguage: "en",
    provider: org,
    educationalLevel: p.level,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: p.hours,
    },
  };
}
