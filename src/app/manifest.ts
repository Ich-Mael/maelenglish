import type { MetadataRoute } from "next";

/** Installable app (Android « Installer l'application », iOS « Sur l'écran d'accueil », Play Store TWA later). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MaelEnglish — Speak the Language of Your Profession",
    short_name: "MaelEnglish",
    description: "L'anglais de votre métier, avec Coach Mael : leçons interactives, exercices, quiz et suivi par un coach.",
    lang: "fr",
    dir: "ltr",
    start_url: "/mes-cours?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fd",
    theme_color: "#364fab",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes cours", short_name: "Cours", url: "/mes-cours?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Ma progression", short_name: "Progression", url: "/progression?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
