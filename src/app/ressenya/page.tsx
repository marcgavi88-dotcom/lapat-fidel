"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

const GOOGLE_REVIEW_URL = "https://g.page/r/Cd_oP1gR0PXpEBE/review";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface ThisMonthReview {
  id: string;
  estado: "pendiente" | "validado" | "rechazado";
  motivo_rechazo: string | null;
  created_at: string;
  validado_at: string | null;
}

export default function RessenyaPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [thisMonth, setThisMonth] = useState<ThisMonthReview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const locale = lang === "ca" ? "ca-ES" : "es-ES";

  // Primer dia d'aquest mes (client-side, serveix per filtrar)
  const monthStartIso = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      setUserId(auth.user.id);

      // Agafem la ressenya més recent del mes actual que encara bloqueja
      // (pendent o validada). Les rebutjades no bloquegen.
      const { data } = await supa
        .from("reviews")
        .select("id, estado, motivo_rechazo, created_at, validado_at")
        .eq("user_id", auth.user.id)
        .gte("created_at", monthStartIso)
        .in("estado", ["pendiente", "validado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setThisMonth(data as ThisMonthReview);
      setLoading(false);
    })();
  }, [router, monthStartIso]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_FILE_BYTES) {
      setError(t.ressenya.errorUpload);
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit() {
    if (!userId || !file) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const supa = createSupabaseBrowser();
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supa.storage
        .from("reviews")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
      if (upErr) {
        setError(t.ressenya.errorUpload);
        setSubmitting(false);
        return;
      }

      const { data, error: rpcErr } = await supa.rpc("request_review", {
        p_screenshot_path: path,
      });
      if (rpcErr) {
        // Errors específics del RPC
        if (rpcErr.message?.includes("already_claimed_this_month")) {
          setError(t.ressenya.errorAlreadyClaimed);
        } else {
          setError(t.ressenya.errorGeneric);
        }
        // Neteja l'objecte pujat per no deixar brossa
        await supa.storage.from("reviews").remove([path]);
        setSubmitting(false);
        return;
      }

      // Refresca l'estat: ara tenim una ressenya pendent aquest mes
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as { id: string; estado: string }) : null;
      if (row) {
        setThisMonth({
          id: row.id,
          estado: "pendiente",
          motivo_rechazo: null,
          created_at: new Date().toISOString(),
          validado_at: null,
        });
      }
      setSuccess(t.ressenya.successMessage);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError(t.ressenya.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">
          ⭐ {t.ressenya.title}
        </h1>
        <p className="mt-1 text-oliva-700">{t.ressenya.subtitle}</p>
      </div>

      {/* Tarja de recompensa */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terracota-600 via-terracota-700 to-terracota-800 p-6 text-white md:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span className="text-5xl">🎁</span>
          <div>
            <p className="text-sm uppercase tracking-wider text-crema-100">
              {t.ressenya.reward}
            </p>
            <p className="mt-1 text-xs text-crema-100">{t.ressenya.limitNote}</p>
          </div>
        </div>
      </div>

      {/* Estats segons mes actual */}
      {thisMonth?.estado === "validado" && (
        <div className="card border-2 border-oliva-300 bg-gradient-to-br from-oliva-50 to-crema-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <h2 className="serif text-lg text-terracota-800">
                {t.ressenya.statusValidated}
              </h2>
              <p className="mt-1 text-sm text-oliva-700">
                {t.ressenya.statusValidatedDesc}
              </p>
              {thisMonth.validado_at && (
                <p className="mt-1 text-xs text-oliva-600">
                  {new Date(thisMonth.validado_at).toLocaleDateString(locale)}
                </p>
              )}
            </div>
          </div>
          <Link href="/dashboard" className="btn-secondary mt-4 inline-flex">
            ← {t.roulette.backToDashboard}
          </Link>
        </div>
      )}

      {thisMonth?.estado === "pendiente" && (
        <div className="card border-2 border-terracota-300 bg-gradient-to-br from-terracota-50 to-crema-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⏳</span>
            <div>
              <h2 className="serif text-lg text-terracota-800">
                {t.ressenya.statusPending}
              </h2>
              <p className="mt-1 text-sm text-oliva-700">
                {t.ressenya.statusPendingDesc}
              </p>
              <p className="mt-1 text-xs text-oliva-600">
                {new Date(thisMonth.created_at).toLocaleDateString(locale)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Si no hi ha bloqueig actiu → mostrar flux complet */}
      {!thisMonth && (
        <>
          {/* Passos */}
          <div className="card">
            <h2 className="serif mb-3 text-xl text-terracota-800">
              {t.ressenya.stepsTitle}
            </h2>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-sm text-oliva-900">{t.ressenya.step1}</p>
                  <a
                    href={GOOGLE_REVIEW_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-terracota-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracota-700"
                  >
                    🔗 {t.ressenya.openGoogle} →
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  2
                </span>
                <p className="flex-1 text-sm text-oliva-900">{t.ressenya.step2}</p>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  3
                </span>
                <p className="flex-1 text-sm text-oliva-900">{t.ressenya.step3}</p>
              </li>
            </ol>
          </div>

          {/* Feedback d'una ressenya rebutjada prèvia (si n'hi ha) */}
          {/* Nota: el bloqueig només s'aplica a pendiente/validada, però si
              l'usuari vol veure la raó del rebuig, fem un join opcional més endavant. */}

          {/* Upload */}
          <div className="card">
            <h2 className="serif mb-3 text-xl text-terracota-800">
              📸 {t.ressenya.uploadLabel}
            </h2>
            <p className="mb-3 text-xs text-oliva-600">{t.ressenya.uploadHint}</p>

            <label
              htmlFor="review-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-oliva-300 bg-crema-50 p-6 text-center hover:border-terracota-400 hover:bg-crema-100"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="preview"
                  className="max-h-80 rounded-xl object-contain"
                />
              ) : (
                <>
                  <span className="text-4xl">📁</span>
                  <span className="mt-2 text-sm font-medium text-terracota-700">
                    {t.ressenya.uploadChoose}
                  </span>
                </>
              )}
            </label>
            <input
              id="review-file"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-3 rounded-lg bg-oliva-50 px-3 py-2 text-sm text-oliva-700">
                {success}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!file || submitting}
              className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t.ressenya.submitting : t.ressenya.submit}
            </button>
          </div>

          {/* Consells */}
          <div className="card bg-crema-50">
            <h3 className="serif mb-2 text-lg text-terracota-800">
              💡 {t.ressenya.tipsTitle}
            </h3>
            <ul className="space-y-1 text-sm text-oliva-700">
              <li>• {t.ressenya.tip1}</li>
              <li>• {t.ressenya.tip2}</li>
              <li>• {tpl(t.ressenya.tip3, {})}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
