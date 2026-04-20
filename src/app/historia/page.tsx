"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

const INSTAGRAM_HANDLE = "apatdelprat";
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface ThisWeekStory {
  id: string;
  estado: "pendiente" | "validado" | "rechazado";
  motivo_rechazo: string | null;
  created_at: string;
  validado_at: string | null;
}

// Primer dia de la setmana actual (dilluns) a mitjanit local
function getMondayIso(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = diumenge, 1 = dilluns...
  const diff = day === 0 ? -6 : 1 - day; // quants dies hem de retrocedir fins a dilluns
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return mon.toISOString();
}

export default function HistoriaPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [thisWeek, setThisWeek] = useState<ThisWeekStory | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const locale = lang === "ca" ? "ca-ES" : "es-ES";
  const weekStartIso = useMemo(() => getMondayIso(), []);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      setUserId(auth.user.id);

      const { data } = await supa
        .from("stories")
        .select("id, estado, motivo_rechazo, created_at, validado_at")
        .eq("user_id", auth.user.id)
        .gte("created_at", weekStartIso)
        .in("estado", ["pendiente", "validado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setThisWeek(data as ThisWeekStory);
      setLoading(false);
    })();
  }, [router, weekStartIso]);

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
      setError(t.historia.errorUpload);
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
        .from("stories")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
      if (upErr) {
        setError(t.historia.errorUpload);
        setSubmitting(false);
        return;
      }

      const { data, error: rpcErr } = await supa.rpc("request_story", {
        p_screenshot_path: path,
      });
      if (rpcErr) {
        if (rpcErr.message?.includes("already_claimed_this_week")) {
          setError(t.historia.errorAlreadyClaimed);
        } else {
          setError(t.historia.errorGeneric);
        }
        await supa.storage.from("stories").remove([path]);
        setSubmitting(false);
        return;
      }

      const row = Array.isArray(data) && data.length > 0 ? (data[0] as { id: string; estado: string }) : null;
      if (row) {
        setThisWeek({
          id: row.id,
          estado: "pendiente",
          motivo_rechazo: null,
          created_at: new Date().toISOString(),
          validado_at: null,
        });
      }
      setSuccess(t.historia.successMessage);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError(t.historia.errorGeneric);
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
          📸 {t.historia.title}
        </h1>
        <p className="mt-1 text-oliva-700">{t.historia.subtitle}</p>
      </div>

      {/* Tarja de recompensa */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 via-terracota-600 to-terracota-800 p-6 text-white md:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span className="text-5xl">🎁</span>
          <div>
            <p className="text-sm uppercase tracking-wider text-crema-100">
              {t.historia.reward}
            </p>
            <p className="mt-1 text-xs text-crema-100">{t.historia.limitNote}</p>
          </div>
        </div>
      </div>

      {/* Estats segons setmana actual */}
      {thisWeek?.estado === "validado" && (
        <div className="card border-2 border-oliva-300 bg-gradient-to-br from-oliva-50 to-crema-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <h2 className="serif text-lg text-terracota-800">
                {t.historia.statusValidated}
              </h2>
              <p className="mt-1 text-sm text-oliva-700">
                {t.historia.statusValidatedDesc}
              </p>
              {thisWeek.validado_at && (
                <p className="mt-1 text-xs text-oliva-600">
                  {new Date(thisWeek.validado_at).toLocaleDateString(locale)}
                </p>
              )}
            </div>
          </div>
          <Link href="/dashboard" className="btn-secondary mt-4 inline-flex">
            ← {t.roulette.backToDashboard}
          </Link>
        </div>
      )}

      {thisWeek?.estado === "pendiente" && (
        <div className="card border-2 border-terracota-300 bg-gradient-to-br from-terracota-50 to-crema-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⏳</span>
            <div>
              <h2 className="serif text-lg text-terracota-800">
                {t.historia.statusPending}
              </h2>
              <p className="mt-1 text-sm text-oliva-700">
                {t.historia.statusPendingDesc}
              </p>
              <p className="mt-1 text-xs text-oliva-600">
                {new Date(thisWeek.created_at).toLocaleDateString(locale)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Si no hi ha bloqueig actiu → mostrar flux complet */}
      {!thisWeek && (
        <>
          {/* Passos */}
          <div className="card">
            <h2 className="serif mb-3 text-xl text-terracota-800">
              {t.historia.stepsTitle}
            </h2>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  1
                </span>
                <p className="flex-1 text-sm text-oliva-900">{t.historia.step1}</p>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm text-oliva-900">{t.historia.step2}</p>
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-terracota-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    📸 {t.historia.openInstagram} @{INSTAGRAM_HANDLE} →
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-bold text-white">
                  3
                </span>
                <p className="flex-1 text-sm text-oliva-900">{t.historia.step3}</p>
              </li>
            </ol>
          </div>

          {/* Upload */}
          <div className="card">
            <h2 className="serif mb-3 text-xl text-terracota-800">
              📷 {t.historia.uploadLabel}
            </h2>
            <p className="mb-3 text-xs text-oliva-600">{t.historia.uploadHint}</p>

            <label
              htmlFor="story-file"
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
                    {t.historia.uploadChoose}
                  </span>
                </>
              )}
            </label>
            <input
              id="story-file"
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
              {submitting ? t.historia.submitting : t.historia.submit}
            </button>
          </div>

          {/* Consells */}
          <div className="card bg-crema-50">
            <h3 className="serif mb-2 text-lg text-terracota-800">
              💡 {t.historia.tipsTitle}
            </h3>
            <ul className="space-y-1 text-sm text-oliva-700">
              <li>• {t.historia.tip1}</li>
              <li>• {t.historia.tip2}</li>
              <li>• {t.historia.tip3}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
