import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { PROGRAMS, shortProgramName, whatsappLink } from "@/lib/catalog";
import { PHONE_DISPLAY, PHONE_TEL, signupHref } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

async function Year() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="bg-brand-deep text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Image src="/images/maelenglish-logo-light.webp" alt="MaelEnglish" width={800} height={259} className="h-auto w-44" />
          <p className="mt-4 max-w-xs text-sm">
            L&apos;anglais général, puis l&apos;anglais de votre métier. 100 % en ligne, avec un coach qui corrige chaque étape.
          </p>
        </div>
        <FooterCol title="Programmes">
          {PROGRAMS.slice(0, 6).map((p) => (
            <FooterLink key={p.slug} href={`/programmes/${p.slug}`}>
              {shortProgramName(p)}
            </FooterLink>
          ))}
          <FooterLink href="/#programmes">Tous les programmes</FooterLink>
        </FooterCol>
        <FooterCol title="MaelEnglish">
          <FooterLink href={signupHref("challenge")}>Challenge (défi quotidien)</FooterLink>
          <FooterLink href="/coaching">Coaching premium</FooterLink>
          <FooterLink href="/#methode">La méthode</FooterLink>
          <FooterLink href="/inscription">S&apos;inscrire</FooterLink>
          <FooterLink href="/connexion">Espace apprenant</FooterLink>
        </FooterCol>
        <FooterCol title="Contact">
          <li>
            <a href={whatsappLink()} target="_blank" rel="noopener" className="flex items-center gap-2 hover:text-white">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          </li>
          <li>
            <a href={`tel:${PHONE_TEL}`} className="flex items-center gap-2 hover:text-white">
              <Phone className="size-4" aria-hidden /> {PHONE_DISPLAY}
            </a>
          </li>
        </FooterCol>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/60">
          © <Year /> MaelEnglish · <span lang="en">Speak the Language of Your Profession</span> ·{" "}
          <Link href="/confidentialite" className="underline hover:text-white">
            Confidentialité
          </Link>
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-heading text-sm font-bold tracking-wide text-white uppercase">{title}</h2>
      <ul className="grid gap-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noopener" className="hover:text-white">
          {children}
        </a>
      ) : (
        <Link href={href} className="hover:text-white">
          {children}
        </Link>
      )}
    </li>
  );
}
