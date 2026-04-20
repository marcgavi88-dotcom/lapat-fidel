"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface ReviewRow {
  id: string;
  user_id: string;
  screenshot_path: string;
  estado: "pendiente" | "validado" | "rechazado";
  puntos_otorgados: number;
  created_at: string;
  validado_at: string | null;
  motivo_rechazo: string | null;
  profiles: { nombre: string; apellidos: string; email: string } | null;
}

type Filter = "pendiente" | "validado" | "rechazado" | "todos";

export default function AdminReviewsPage() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState<Filter>("pendiente");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const supa = createSupabaseBrowser();
    setLoading(true);
    const { data, error } = await supa
      .from("reviews")
      .select(
        "id, user_id, screenshot_path, estado, puntos_otorgados, created_at, validado_at, motivo_rechazo, profiles!reviews_user_id_fkey(nombre, apellidos, email)"
      )
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setLoadError(null);
    const rows = (data ?? []) as unknown as ReviewRow[];
    setReviews(rows);

    // Genera signed URLs per les captures (1h de validesa)
    const urls: Record<string, string> = {};
    await Promise.all(
      rows.map(async (r) => {
        const { data: signed } = await supa.storage
          .from("reviews")
          .createSignedUrl(r.screenshot_path, 3600);
        if (signed?.signedUrl) urls[r.id] = signed.signedUrl;
      })
    );
    setSignedUrls(urls);
    setLoading(false);
  }

  async function handleValidate(id: string) {
    setProcessingId(id);
    const supa = createSupabaseBrowser();
    const { error } = await supa.rpc("process_review", {
      p_review_id: id,
      p_action: "validate",
    });
    if (error) {
      alert(`Error: ${error.message}`);
    }
    setProcessingId(null);
    cargar();
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    const supa = createSupabaseBrowser();
    const { error } = await supa.rpc("process_review", {
      p_review_id: id,
      p_action: "reject",
      p_motivo: motivo.trim() || null,
    });
    if (error) {
      alert(`Error: ${error.message}`);
    }
    setRejectingId(null);
    setMotivo("");
    setProcessingId(null);
    cargar();
  }

  const filtradas = reviews.filter(
    (r) => filtro === "todos" || r.estado === filtro
  );

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="serif text-3xl text-terracota-800">⭐ {t.admin.reviewsTitle}</h1>
        <p className="mt-1 text-sm text-oliva-700">{t.admin.reviewsSubtitle}</p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Error: {loadError}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: "pendiente" as Filter, l: t.admin.reviewsStatusPending },
          { k: "validado" as Filter, l: t.admin.reviewsStatusValidated },
          { k: "rechazado" as Filter, l: t.admin.reviewsStatusRejected },
          { k: "todos" as Filter, l: "Tots" },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltro(f.k)}
            className={`rounded-full px-4 py-2 text-sm ${
              filtro === f.k
                ? "bg-terracota-600 text-white"
                : "border border-oliva-200 bg-white text-oliva-800 hover:bg-oliva-50"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Graella */}
      {filtradas.length === 0 ? (
        <div className="card text-center text-oliva-600">
          {t.admin.reviewsEmpty}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtradas.map((r) => {
            const url = signedUrls[r.id];
            const nomComplet = `${r.profiles?.nombre ?? ""} ${r.profiles?.apellidos ?? ""}`.trim();
            const estadoColor =
              r.estado === "validado"
                ? "bg-oliva-100 text-oliva-800"
                : r.estado === "rechazado"
                ? "bg-red-100 text-red-800"
                : "bg-terracota-100 text-terracota-800";
            const estadoLabel =
              r.estado === "validado"
                ? t.admin.reviewsStatusValidated
                : r.estado === "rechazado"
                ? t.admin.reviewsStatusRejected
                : t.admin.reviewsStatusPending;

            return (
              <div key={r.id} className="card flex flex-col gap-3">
                {/* Capçalera client */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-oliva-900">
                      {nomComplet || r.profiles?.email}
                    </p>
                    <p className="truncate text-xs text-oliva-600">
                      {r.profiles?.email}
                    </p>
                    <p className="mt-1 text-xs text-oliva-500">
                      {new Date(r.created_at).toLocaleString("ca-ES")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${estadoColor}`}
                  >
                    {estadoLabel}
                  </span>
                </div>

                {/* Captura */}
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-crema-200 bg-crema-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Ressenya"
                      className="max-h-80 w-full object-contain"
                    />
                  </a>
                ) : (
                  <div className="rounded-xl bg-crema-100 py-8 text-center text-xs text-oliva-600">
                    {t.common.loading}
                  </div>
                )}

                {/* Motiu si rebutjada */}
                {r.estado === "rechazado" && r.motivo_rechazo && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    {r.motivo_rechazo}
                  </div>
                )}
                {r.estado === "validado" && r.validado_at && (
                  <div className="rounded-lg bg-oliva-50 px-3 py-2 text-xs text-oliva-700">
                    +{r.puntos_otorgados} pts ·{" "}
                    {new Date(r.validado_at).toLocaleString("ca-ES")}
                  </div>
                )}

                {/* Accions */}
                {r.estado === "pendiente" && (
                  <div className="flex flex-col gap-2">
                    {rejectingId === r.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder={t.admin.reviewsRejectPrompt}
                          className="w-full rounded-lg border border-oliva-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={processingId === r.id}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {t.admin.reviewsRejectConfirm}
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setMotivo("");
                            }}
                            className="rounded-lg border border-oliva-200 bg-white px-3 py-2 text-sm text-oliva-700 hover:bg-oliva-50"
                          >
                            {t.common.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleValidate(r.id)}
                          disabled={processingId === r.id}
                          className="flex-1 rounded-lg bg-oliva-600 px-3 py-2 text-sm font-medium text-white hover:bg-oliva-700 disabled:opacity-50"
                        >
                          ✓ {t.admin.reviewsValidate}
                        </button>
                        <button
                          onClick={() => setRejectingId(r.id)}
                          disabled={processingId === r.id}
                          className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          ✗ {t.admin.reviewsReject}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
