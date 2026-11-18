import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#contenu-principal" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu-principal" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
