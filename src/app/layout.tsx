import type { Metadata, Viewport } from "next";
import { Archivo, Outfit } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MaelEnglish — Speak the Language of Your Profession",
    template: "%s · MaelEnglish",
  },
  description:
    "Programmes d’anglais 100 % en ligne : anglais général et anglais professionnel (aviation, business, santé, tech, finance…), avec un coach dédié.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "MaelEnglish",
    images: ["/images/maelenglish-og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#364fab",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${archivo.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
