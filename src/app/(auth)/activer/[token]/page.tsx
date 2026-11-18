import type { Metadata } from "next";
import { Suspense } from "react";
import { TokenPage, TokenPageFallback } from "@/components/auth/token-page";

export const metadata: Metadata = { title: "Activer mon compte", robots: { index: false }, referrer: "no-referrer" };

export default function Page({ params }: PageProps<"/activer/[token]">) {
  return (
    <Suspense fallback={<TokenPageFallback />}>
      <TokenPage params={params} purpose="activation" />
    </Suspense>
  );
}
