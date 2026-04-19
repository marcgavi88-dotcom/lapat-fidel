"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

// Importem el tipus només — el runtime es carrega dinàmicament més avall
// (html5-qrcode no és SSR-safe perquè accedeix a navigator.mediaDevices)
type Html5QrcodeInstance = {
  start: (
    cameraIdOrConfig: unknown,
    config: unknown,
    onSuccess: (decodedText: string) => void,
    onError?: (err: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
  getRunningTrackCameraCapabilities?: () => {
    torchFeature?: () => { isSupported: () => boolean; apply: (v: boolean) => Promise<void> };
  } | null;
};

const READER_ID = "qr-reader-container";

function extractCodigo(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Si és una URL del tipus https://.../qr/XYZ
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);
    const qrIdx = parts.indexOf("qr");
    if (qrIdx >= 0 && parts[qrIdx + 1]) return parts[qrIdx + 1];
  } catch {
    // no és URL vàlida → assumim que és el codi pelat
  }
  // Si sembla un codi (alfanumèric curt, sense espais)
  if (/^[A-Za-z0-9_-]{4,40}$/.test(trimmed)) return trimmed;
  return null;
}

export default function ScanPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const startedRef = useRef(false);

  // 1) Comprovar que l'usuari està loguejat (si no, redirigir a /login)
  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login?next=/scan");
        return;
      }
      setLoggedIn(true);
      setChecking(false);
    });
  }, [router]);

  // 2) Arrencar l'escàner quan estem loguejats
  useEffect(() => {
    if (!loggedIn || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new mod.Html5Qrcode(READER_ID, { verbose: false }) as unknown as Html5QrcodeInstance;
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decodedText: string) => handleDecoded(decodedText),
          () => { /* frames sense QR → silenci */ }
        );
        setScanning(true);
        setError(null);

        // Detectar torxa (flashlight) si el dispositiu la suporta
        try {
          const caps = instance.getRunningTrackCameraCapabilities?.();
          const torch = caps?.torchFeature?.();
          if (torch?.isSupported()) setTorchSupported(true);
        } catch {
          // ignorar
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes("Permission") || msg.includes("NotAllowed") ? "permission" : "camera");
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      if (inst) {
        inst
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              inst.clear();
            } catch {
              // ignorar
            }
          });
      }
    };
  }, [loggedIn]);

  const handleDecoded = async (raw: string) => {
    const codigo = extractCodigo(raw);
    if (!codigo) {
      setError("invalid_qr");
      return;
    }
    // Aturem la càmera abans de navegar per alliberar el sensor
    try {
      await scannerRef.current?.stop();
    } catch {
      // ignorar
    }
    router.push(`/qr/${codigo}`);
  };

  const toggleTorch = async () => {
    try {
      const caps = scannerRef.current?.getRunningTrackCameraCapabilities?.();
      const torch = caps?.torchFeature?.();
      if (torch?.isSupported()) {
        await torch.apply(!torchOn);
        setTorchOn((v) => !v);
      }
    } catch {
      // ignorar
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = extractCodigo(manualCode);
    if (!codigo) {
      setError("invalid_code");
      return;
    }
    router.push(`/qr/${codigo}`);
  };

  if (checking) {
    return <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">{t.common.loading}</div>;
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="mb-4 text-center">
        <h1 className="serif text-3xl text-terracota-800">{t.scan.title}</h1>
        <p className="mt-1 text-sm text-oliva-700">{t.scan.subtitle}</p>
      </div>

      {/* Caixa del visor de càmera */}
      <div className="relative overflow-hidden rounded-3xl bg-black shadow-lg">
        <div id={READER_ID} className="aspect-square w-full" />

        {/* Overlay: marc de l'enfocament */}
        {scanning && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[70%] w-[70%]">
              <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-crema-50 rounded-tl-lg" />
              <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-crema-50 rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-crema-50 rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-crema-50 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Estats d'error a sobre del visor */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <div className="text-5xl">
              {error === "permission" ? "🎥" : error === "invalid_qr" ? "❓" : "⚠️"}
            </div>
            <p className="text-sm">
              {error === "permission" && t.scan.errorPermission}
              {error === "camera" && t.scan.errorCamera}
              {error === "invalid_qr" && t.scan.errorInvalidQr}
              {error === "invalid_code" && t.scan.errorInvalidCode}
            </p>
            {error !== "camera" && error !== "permission" && (
              <button onClick={() => setError(null)} className="btn-primary">
                {t.scan.tryAgain}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Torxa */}
      {scanning && torchSupported && !error && (
        <button
          onClick={toggleTorch}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-oliva-300 bg-white px-4 py-2 text-sm"
        >
          <span>{torchOn ? "🔆" : "🔦"}</span>
          <span>{torchOn ? t.scan.torchOff : t.scan.torchOn}</span>
        </button>
      )}

      {/* Instruccions */}
      <div className="mt-6 rounded-2xl border border-crema-200 bg-white p-4 text-sm text-oliva-700">
        <p className="font-medium text-terracota-800">{t.scan.instructionsTitle}</p>
        <p className="mt-1">{t.scan.instructionsBody}</p>
      </div>

      {/* Fallback manual */}
      <form onSubmit={handleManualSubmit} className="mt-6 rounded-2xl border border-crema-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-terracota-800">
          {t.scan.manualTitle}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t.scan.manualPlaceholder}
            className="input-field flex-1"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button type="submit" className="btn-primary !px-4">
            OK
          </button>
        </div>
        <p className="mt-2 text-xs text-oliva-600">{t.scan.manualHint}</p>
      </form>

      <div className="mt-4 text-center">
        <Link href="/dashboard" className="text-sm text-oliva-600 underline">
          {t.common.back}
        </Link>
      </div>
    </div>
  );
}
