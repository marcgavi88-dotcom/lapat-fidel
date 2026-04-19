"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface Premio {
  id: string;
  nombre_ca: string;
  nombre_es: string;
  descripcion_ca: string | null;
  descripcion_es: string | null;
  puntos_necesarios: number;
}

interface Canje {
  id: string;
  codigo_canje: string;
  estado: string;
  created_at: string;
  premios: { nombre_ca: string; nombre_es: string } | null;
}

export default function RewardsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [misCanjes, setMisCanjes] = useState<Canje[]>([]);
  const [puntos, setPuntos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState<Premio | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [codigoRecibido, setCodigoRecibido] = useState<string | null>(null);

  const cargarDatos = async () => {
    const supa = createSupabaseBrowser();
    const { data: auth } = await supa.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }
    const [prof, prem, canj] = await Promise.all([
      supa.from("profiles").select("puntos_total").eq("id", auth.user.id).single(),
      supa.from("premios").select("*").eq("activo", true).order("orden"),
      supa
        .from("canjes")
        .select("id, codigo_canje, estado, created_at, premios(nombre_ca, nombre_es)")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (prof.data) setPuntos(prof.data.puntos_total);
    if (prem.data) setPremios(prem.data);
    if (canj.data) setMisCanjes(canj.data as unknown as Canje[]);
    setLoading(false);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const confirmarCanje = async () => {
    if (!confirmando) return;
    setProcesando(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premio_id: confirmando.id }),
      });
      const json = await res.json();
      if (json.ok) {
        setCodigoRecibido(json.codigo_canje);
        setConfirmando(null);
        await cargarDatos();
      } else {
        alert(t.common.error);
      }
    } finally {
      setProcesando(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.rewards.title}</h1>
        <p className="mt-1 text-oliva-700">{t.rewards.subtitle}</p>
      </div>

      {/* Puntos actuales */}
      <div className="flex items-center justify-between rounded-2xl bg-terracota-600 px-6 py-4 text-white">
        <span className="text-sm uppercase tracking-wider text-crema-100">{t.rewards.yourPoints}</span>
        <span className="serif text-3xl font-semibold">{puntos}</span>
      </div>

      {/* Catálogo */}
      <div className="grid gap-4 md:grid-cols-2">
        {premios.map((p) => {
          const nombre = lang === "ca" ? p.nombre_ca : p.nombre_es;
          const desc = lang === "ca" ? p.descripcion_ca : p.descripcion_es;
          const puedeCanjear = puntos >= p.puntos_necesarios;
          return (
            <div key={p.id} className={`card ${!puedeCanjear ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="serif text-xl text-terracota-800">{nombre}</h3>
                  {desc && <p className="mt-1 text-sm text-oliva-700">{desc}</p>}
                  <p className="mt-3 text-terracota-600">
                    <span className="serif text-2xl font-semibold">{p.puntos_necesarios}</span>{" "}
                    <span className="text-sm">{t.dashboard.points}</span>
                  </p>
                </div>
              </div>
              {puedeCanjear ? (
                <button onClick={() => setConfirmando(p)} className="btn-primary mt-4 w-full">
                  {t.rewards.redeem}
                </button>
              ) : (
                <p className="mt-4 text-center text-sm text-oliva-600">
                  {tpl(t.rewards.notEnough, { points: p.puntos_necesarios - puntos })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Mis códigos */}
      <div className="card">
        <h2 className="serif mb-4 text-xl text-terracota-800">{t.rewards.myCodes}</h2>
        {misCanjes.length === 0 ? (
          <p className="text-oliva-600">{t.rewards.noCodes}</p>
        ) : (
          <ul className="divide-y divide-crema-200">
            {misCanjes.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {lang === "ca" ? c.premios?.nombre_ca : c.premios?.nombre_es}
                  </p>
                  <p className="text-xs text-oliva-600">
                    {new Date(c.created_at).toLocaleDateString(lang === "ca" ? "ca-ES" : "es-ES")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold text-terracota-700">{c.codigo_canje}</p>
                  <span className={`text-xs ${c.estado === "validado" ? "text-oliva-600" : "text-terracota-600"}`}>
                    {c.estado === "validado" ? t.rewards.validated : t.rewards.pending}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal confirmación */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !procesando && setConfirmando(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-5xl">🎁</div>
            <h3 className="serif text-xl text-terracota-800">{t.rewards.confirmRedeem}</h3>
            <p className="mt-2 text-oliva-700">
              {tpl(t.rewards.confirmText, { points: confirmando.puntos_necesarios })}
            </p>
            <p className="mt-2 font-medium">
              {lang === "ca" ? confirmando.nombre_ca : confirmando.nombre_es}
            </p>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setConfirmando(null)} disabled={procesando} className="btn-secondary flex-1">
                {t.rewards.cancel}
              </button>
              <button onClick={confirmarCanje} disabled={procesando} className="btn-primary flex-1">
                {procesando ? t.common.loading : t.rewards.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal código recibido */}
      {codigoRecibido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCodigoRecibido(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-5xl">🎉</div>
            <h3 className="serif text-2xl text-terracota-800">{t.rewards.redeemSuccess}</h3>
            <p className="mt-2 text-oliva-700">{t.rewards.showCode}</p>
            <div className="my-6 rounded-xl bg-terracota-50 px-6 py-4 font-mono text-4xl font-bold tracking-wider text-terracota-700">
              {codigoRecibido}
            </div>
            <button onClick={() => setCodigoRecibido(null)} className="btn-primary w-full">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
