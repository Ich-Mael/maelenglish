import type { Metadata } from "next";
import { Suspense } from "react";
import { TokenPage, TokenPageFallback } from "@/components/auth/token-page";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false }, referrer: "no-referrer" };

export default function Page({ params }: PageProps<"/reinitialiser/[token]">) {
  return (
    <Suspense fallback={<TokenPageFallback />}>
      <TokenPage params={params} purpose="reset" />
    </Suspense>
  );
}
