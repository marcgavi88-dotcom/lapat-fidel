"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface Canje {
  id: string;
  codigo_canje: string;
  estado: string; // 'pendiente' | 'validado' | 'rechazado'
  puntos_usados: number;
  created_at: string;
  validado_at: string | null;
  premios: { nombre_ca: string; nombre_es: string } | null;
}

export default function MisPremiosPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<Canje | null>(null);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supa
        .from("canjes")
        .select(
          "id, codigo_canje, estado, puntos_usados, created_at, validado_at, premios(nombre_ca, nombre_es)"
        )
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });
      if (data) setCanjes(data as unknown as Canje[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }

  const actius = canjes.filter((c) => c.estado === "pendiente");
  const historial = canjes.filter((c) => c.estado !== "pendiente");
  const locale = lang === "ca" ? "ca-ES" : "es-ES";

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.misPremios.title}</h1>
        <p className="mt-1 text-oliva-700">{t.misPremios.subtitle}</p>
      </div>

      {/* Info: com bescanviar (flux cambrer) */}
      <div className="rounded-2xl border border-terracota-200 bg-crema-50 p-5">
        <h3 className="serif text-lg text-terracota-800">{t.misPremios.waiterFlowTitle}</h3>
        <ol className="mt-3 space-y-2.5">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-semibold text-white">
              1
            </span>
            <span className="pt-0.5 text-sm text-oliva-800">{t.misPremios.waiterFlowStep1}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-600 text-sm font-semibold text-white">
              2
            </span>
            <span className="pt-0.5 text-sm text-oliva-800">{t.misPremios.waiterFlowStep2}</span>
          </li>
        </ol>
        <p className="mt-3 text-xs text-oliva-600">{t.misPremios.waiterFlowFooter}</p>
      </div>

      {/* Codis actius */}
      <section className="space-y-3">
        <h2 className="serif text-xl text-terracota-800">
          {t.misPremios.activeCodes}
          {actius.length > 0 && (
            <span className="ml-2 rounded-full bg-terracota-600 px-2 py-0.5 text-xs font-semibold text-white">
              {actius.length}
            </span>
          )}
        </h2>

        {actius.length === 0 ? (
          <div className="card text-center">
            <div className="mb-3 text-4xl">🎁</div>
            <p className="text-oliva-700">{t.misPremios.noActive}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/roulette" className="btn-primary">
                🎡 {t.misPremios.goToRoulette}
              </Link>
              <Link href="/rewards" className="btn-secondary">
                {t.misPremios.goToRewards}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-oliva-600">{t.misPremios.tapToShow}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {actius.map((c) => {
                const nombre = lang === "ca" ? c.premios?.nombre_ca : c.premios?.nombre_es;
                return (
                  <button
                    key={c.id}
                    onClick={() => setZoom(c)}
                    className="card flex items-center justify-between gap-4 text-left transition hover:shadow-md"
                  >
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wider text-terracota-600">
                        {t.misPremios.statusPending}
                      </p>
                      <p className="mt-1 font-medium text-oliva-900">{nombre}</p>
                      <p className="mt-1 text-xs text-oliva-600">
                        {new Date(c.created_at).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-2xl font-bold tracking-wider text-terracota-700">
                        {c.codigo_canje}
                      </span>
                      <span className="mt-1 text-xs text-oliva-600">🔍 {t.misPremios.tapToShow}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Historial */}
      {historial.length > 0 && (
        <section className="space-y-3">
          <h2 className="serif text-xl text-terracota-800">{t.misPremios.historyCodes}</h2>
          <div className="card overflow-x-auto">
            <ul className="divide-y divide-crema-200">
              {historial.map((c) => {
                const nombre = lang === "ca" ? c.premios?.nombre_ca : c.premios?.nombre_es;
                const isValidated = c.estado === "validado";
                const statusLabel = isValidated
                  ? t.misPremios.statusValidated
                  : t.misPremios.statusRejected;
                const statusColor = isValidated ? "text-oliva-600" : "text-red-600";
                const dateLabel = c.validado_at
                  ? tpl(isValidated ? t.misPremios.redeemedOn : t.misPremios.rejectedOn, {
                      date: new Date(c.validado_at).toLocaleDateString(locale),
                    })
                  : new Date(c.created_at).toLocaleDateString(locale);

                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-oliva-900">{nombre}</p>
                      <p className="mt-0.5 text-xs text-oliva-600">{dateLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-oliva-500 line-through">
                        {c.codigo_canje}
                      </p>
                      <p className={`mt-0.5 text-xs font-semibold uppercase ${statusColor}`}>
                        {statusLabel}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Modal codi en gran */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoom(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">🎁</div>
            <p className="mt-3 serif text-xl text-terracota-800">
              {lang === "ca" ? zoom.premios?.nombre_ca : zoom.premios?.nombre_es}
            </p>
            <p className="mt-2 text-sm text-oliva-700">{t.misPremios.showAtCounter}</p>
            <div className="my-6 rounded-2xl bg-terracota-50 px-4 py-6 font-mono text-5xl font-bold tracking-widest text-terracota-700 md:text-6xl">
              {zoom.codigo_canje}
            </div>
            <p className="text-xs text-oliva-600">
              {new Date(zoom.created_at).toLocaleDateString(locale)}
            </p>
            <button onClick={() => setZoom(null)} className="btn-primary mt-6 w-full">
              {t.misPremios.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
