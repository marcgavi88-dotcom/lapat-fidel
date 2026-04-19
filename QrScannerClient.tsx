"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

const READER_ID = "qr-reader-container";

function extractCodigo(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // 1) Si es una URL con /qr/XYZ en la ruta
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);
    const qrIdx = parts.indexOf("qr");
    if (qrIdx >= 0 && parts[qrIdx + 1]) return parts[qrIdx + 1];
  } catch {
    // no es URL válida
  }
  // 2) Código "pelado" alfanumérico
  if (/^[A-Za-z0-9_-]{4,40}$/.test(trimmed)) return trimmed;
  return null;
}

export default function QrScannerClient() {
  const router = useRouter();
  const { t } = useI18n();

  const [stage, setStage] = useState<"checking" | "ready" | "error">("checking");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const decodedRef = useRef(false);
  const scannerRef = useRef<{ stop?: () => Promise<void>; clear?: () => void } | null>(null);

  // 1) Check de sesión
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supa = createSupabaseBrowser();
        const { data } = await supa.auth.getUser();
        if (!alive) return;
        if (!data.user) {
          router.replace("/login?next=/scan");
          return;
        }
        setStage("ready");
      } catch {
        if (!alive) return;
        setStage("error");
        setErrorKey("auth");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // 2) Arrancar escáner cuando ready
  useEffect(() => {
    if (stage !== "ready") return;

    let stopped = false;
    let instance: unknown = null;

    (async () => {
      try {
        const mod = await import("html5-qrcode").catch(() => null);
        if (!mod || !("Html5Qrcode" in mod)) {
          setStage("error");
          setErrorKey("library");
          return;
        }
        if (stopped) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctor: any = (mod as any).Html5Qrcode;
        const div = document.getElementById(READER_ID);
        if (!div) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inst: any = new Ctor(READER_ID, /* verbose */ false);
        instance = inst;
        scannerRef.current = inst;

        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            if (decodedRef.current) return;
            const codigo = extractCodigo(decodedText);
            if (!codigo) {
              setErrorKey("invalid_qr");
              return;
            }
            decodedRef.current = true;
            // Parar la cámara antes de navegar
            Promise.resolve(inst.stop?.())
              .catch(() => undefined)
              .finally(() => router.push(`/qr/${codigo}`));
          },
          () => {
            /* frames sin QR: ignorar */
          }
        );

        if (stopped) {
          try {
            await inst.stop();
          } catch {
            // ignorar
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Permission|NotAllowed/i.test(msg)) {
          setErrorKey("permission");
        } else if (/NotFound|NotReadable|OverconstrainedError/i.test(msg)) {
          setErrorKey("camera");
        } else {
          setErrorKey("start");
        }
        setStage("error");
      }
    })();

    return () => {
      stopped = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst: any = instance;
      if (inst) {
        Promise.resolve(inst.stop?.())
          .catch(() => undefined)
          .finally(() => {
            try {
              inst.clear?.();
            } catch {
              // ignorar
            }
          });
      }
    };
  }, [stage, router]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = extractCodigo(manualCode);
    if (!codigo) {
      setErrorKey("invalid_code");
      return;
    }
    router.push(`/qr/${codigo}`);
  };

  const errorMsg = (() => {
    switch (errorKey) {
      case "permission":
        return t.scan.errorPermission;
      case "camera":
        return t.scan.errorCamera;
      case "invalid_qr":
        return t.scan.errorInvalidQr;
      case "invalid_code":
        return t.scan.errorInvalidCode;
      case "library":
      case "start":
      case "auth":
      default:
        return t.scan.errorCamera;
    }
  })();

  if (stage === "checking") {
    return <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">{t.common.loading}</div>;
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="mb-4 text-center">
        <h1 className="serif text-3xl text-terracota-800">{t.scan.title}</h1>
        <p className="mt-1 text-sm text-oliva-700">{t.scan.subtitle}</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-black shadow-lg">
        <div id={READER_ID} className="aspect-square w-full" />

        {stage === "ready" && !errorKey && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[70%] w-[70%]">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-crema-50" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-crema-50" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-crema-50" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-crema-50" />
            </div>
          </div>
        )}

        {errorKey && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <div className="text-5xl">
              {errorKey === "permission" ? "\u{1F3A5}" : errorKey === "invalid_qr" || errorKey === "invalid_code" ? "\u2753" : "\u26A0\uFE0F"}
            </div>
            <p className="text-sm">{errorMsg}</p>
            {(errorKey === "invalid_qr" || errorKey === "invalid_code") && (
              <button onClick={() => setErrorKey(null)} className="btn-primary">
                {t.scan.tryAgain}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-crema-200 bg-white p-4 text-sm text-oliva-700">
        <p className="font-medium text-terracota-800">{t.scan.instructionsTitle}</p>
        <p className="mt-1">{t.scan.instructionsBody}</p>
      </div>

      <form onSubmit={handleManualSubmit} className="mt-6 rounded-2xl border border-crema-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-terracota-800">{t.scan.manualTitle}</label>
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
