"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/provider";

// Tipus per a l'event beforeinstallprompt (no està a TypeScript per defecte)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

type Platform = "ios-safari" | "ios-other" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";

  // iPad amb iPadOS 13+ es presenta com a Mac amb touch
  const isiOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);

  if (isiOS) {
    // A iOS tots els navegadors van sobre WebKit, però només Safari té "Afegir a pantalla d'inici"
    // Chrome iOS: "CriOS" · Firefox iOS: "FxiOS" · Edge iOS: "EdgiOS"
    // Navegadors in-app: FBAN/FBAV (Facebook), Instagram, Line, WhatsApp, GSA (Google app)
    const isInAppOrOtherBrowser =
      /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|FBAN|FBAV|Instagram|Line|WhatsApp|GSA/i.test(ua);
    return isInAppOrOtherBrowser ? "ios-other" : "ios-safari";
  }

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
  // comencem a true per evitar el "flash" del banner si l'usuari ja té la PWA instal·lada
  const [standalone, setStandalone] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Si l'usuari acaba d'instal·lar l'app, amaga el banner
    const installedHandler = () => setStandalone(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // No mostrem res si ja està instal·lada o si encara no sabem la plataforma
  if (standalone) return null;
  if (platform === "unknown") return null;

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // ignorar
    }
    setDeferred(null);
  };

  return (
    <div className="mt-4 rounded-2xl border-2 border-terracota-300 bg-gradient-to-br from-terracota-50 to-crema-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-terracota-600 text-2xl text-white shadow">
          📱
        </div>
        <div className="flex-1">
          <p className="font-semibold text-terracota-800">{t.install.title}</p>
          <p className="mt-1 text-sm text-oliva-700">{t.install.subtitle}</p>

          {/* ==================== ANDROID ==================== */}
          {platform === "android" && deferred && (
            <button
              onClick={handleInstall}
              className="mt-4 rounded-full bg-terracota-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-terracota-700"
            >
              {t.install.cta}
            </button>
          )}

          {platform === "android" && !deferred && (
            <div className="mt-4 rounded-xl bg-white/70 p-4">
              <p className="text-sm font-medium text-terracota-800">{t.install.androidTitle}</p>
              <ol className="mt-3 space-y-2 text-sm text-oliva-800">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">1</span>
                  <span>{t.install.androidStep1}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">2</span>
                  <span>{t.install.androidStep2}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">3</span>
                  <span>{t.install.androidStep3}</span>
                </li>
              </ol>
            </div>
          )}

          {/* ==================== DESKTOP ==================== */}
          {platform === "desktop" && deferred && (
            <button
              onClick={handleInstall}
              className="mt-4 rounded-full bg-terracota-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-terracota-700"
            >
              {t.install.cta}
            </button>
          )}

          {platform === "desktop" && !deferred && (
            <div className="mt-4 rounded-xl bg-white/70 p-4">
              <p className="text-sm font-medium text-terracota-800">{t.install.desktopTitle}</p>
              <ol className="mt-3 space-y-2 text-sm text-oliva-800">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">1</span>
                  <span>{t.install.desktopStep1}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">2</span>
                  <span>{t.install.desktopStep2}</span>
                </li>
              </ol>
            </div>
          )}

          {/* ==================== iOS SAFARI ==================== */}
          {platform === "ios-safari" && (
            <div className="mt-4 rounded-xl bg-white/70 p-4">
              <p className="text-sm font-medium text-terracota-800">{t.install.iosTitle}</p>
              <ol className="mt-3 space-y-3 text-sm text-oliva-800">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {t.install.iosStep1}
                    <span className="inline-flex items-center gap-1 rounded-md bg-azulmar-50 px-1.5 py-0.5 text-azulmar-700">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 2l-5 5h3v8h4V7h3l-5-5zm-7 14v4a2 2 0 002 2h10a2 2 0 002-2v-4h-2v4H7v-4H5z" />
                      </svg>
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">2</span>
                  <span>{t.install.iosStep2}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 text-xs font-semibold text-terracota-700">3</span>
                  <span>{t.install.iosStep3}</span>
                </li>
              </ol>
            </div>
          )}

          {/* ==================== iOS ALTRES NAVEGADORS ==================== */}
          {platform === "ios-other" && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">⚠️ {t.install.iosOpenInSafari}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
