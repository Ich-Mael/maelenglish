"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const KEY = "me-install-dismissed";

/** « Installer l'application » card: native prompt on Android / Chrome, instructions on iPhone (Safari). */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(KEY);
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection, browser-only
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!event && !ios)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setHidden(true);
  };
  return (
    <div className="relative flex items-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-brand-dark p-4 pr-10 text-white">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <Smartphone className="size-6" aria-hidden />
      </span>
      <div className="flex-1 text-sm">
        <p className="font-heading text-base font-bold">Installez l&apos;application MaelEnglish</p>
        {ios ? (
          <p className="text-white/85">
            Touchez <Share className="inline size-4 align-text-bottom" aria-label="Partager" /> puis « Sur l&apos;écran d&apos;accueil ».
          </p>
        ) : (
          <p className="text-white/85">Accès direct depuis votre écran d&apos;accueil, même hors ligne.</p>
        )}
      </div>
      {event && (
        <button
          type="button"
          onClick={async () => {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice.outcome === "accepted") setHidden(true);
            setEvent(null);
          }}
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-primary"
        >
          Installer
        </button>
      )}
      <button type="button" onClick={dismiss} className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10" aria-label="Ne plus afficher">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
