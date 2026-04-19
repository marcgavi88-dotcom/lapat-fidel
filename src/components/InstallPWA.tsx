"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/provider";

// Tipus per a l'event beforeinstallprompt (no està a TypeScript per defecte)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

type Platform = "ios" | "android" | "desktop" | "unknown";

const DISMISS_KEY = "lapat_install_dismissed_at";
// No torna a aparèixer fins passades 24 h des del darrer "tancar"
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  // iPad amb iPadOS 13+ es presenta com a Mac amb touch
  const isiOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);
  if (isiOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Android / Chrome / Edge
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

export default function InstallPWA() {
  const { t } = useI18n();

  const [platform, setPlatform] = useState<Platform>("unknown");
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    // Comprovar si l'usuari el va tancar fa poc
    try {
      const lastDismiss = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (lastDismiss && Date.now() - lastDismiss < SNOOZE_MS) return;
    } catch {
      // ignorar
    }

    const p = detectPlatform();
    setPlatform(p);

    if (p === "ios") {
      // iOS Safari no dispara beforeinstallprompt → mostrem ajuda manual
      setVisible(true);
      return;
    }

    if (p === "android" || p === "desktop") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignorar
    }
    setVisible(false);
    setShowIosHelp(false);
  };

  const handleInstall = async () => {
    if (platform === "ios") {
      setShowIosHelp(true);
      return;
    }
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        // ignorar
      }
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Banner principal */}
      <div className="mt-4 rounded-2xl border-2 border-terracota-300 bg-gradient-to-br from-terracota-50 to-crema-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-terracota-600 text-2xl text-white shadow">
            📱
          </div>
          <div className="flex-1">
            <p className="font-semibold text-terracota-800">{t.install.title}</p>
            <p className="mt-1 text-xs text-oliva-700">{t.install.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleInstall}
                className="rounded-full bg-terracota-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-terracota-700"
              >
                {t.install.cta}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-full border border-oliva-300 bg-white px-4 py-2 text-sm text-oliva-700 hover:bg-oliva-50"
              >
                {t.install.later}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal d'ajuda iOS */}
      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={handleDismiss}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl text-terracota-800">{t.install.iosTitle}</h3>
            <ol className="mt-4 space-y-3 text-sm text-oliva-800">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">
                  1
                </span>
                <span>
                  {t.install.iosStep1}{" "}
                  <span className="inline-flex items-center gap-1 rounded-md bg-azulmar-50 px-1.5 py-0.5 text-azulmar-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l-5 5h3v8h4V7h3l-5-5zm-7 14v4a2 2 0 002 2h10a2 2 0 002-2v-4h-2v4H7v-4H5z" />
                    </svg>
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">
                  2
                </span>
                <span>{t.install.iosStep2}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">
                  3
                </span>
                <span>{t.install.iosStep3}</span>
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className="mt-5 w-full rounded-full bg-terracota-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              {t.install.iosGotIt}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
