"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";
import InstallPWA from "@/components/InstallPWA";
import RankingWidget from "@/components/RankingWidget";
import TitlesGrid from "@/components/TitlesGrid";

interface Profile {
  id: string;
  nombre: string;
  apellidos: string;
  puntos_total: number;
  puntos_menu: number;
  ultimo_giro_ruleta: string | null;
  total_croquetas: number;
  tiradas_ruleta: number;
  tiradas_ruleta_pro: number;
}

interface Movimiento {
  id: string;
  puntos: number;
  tipo: string;
  descripcion: string;
  created_at: string;
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [canjesActius, setCanjesActius] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supa
        .from("profiles")
        .select("id, nombre, apellidos, puntos_total, puntos_menu, ultimo_giro_ruleta, total_croquetas, tiradas_ruleta, tiradas_ruleta_pro")
        .eq("id", auth.user.id)
        .single();
      if (prof) setProfile(prof);

      const { data: movs } = await supa
        .from("movimientos_puntos")
        .select("id, puntos, tipo, descripcion, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (movs) setMovimientos(movs);

      const { count } = await supa
        .from("canjes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("estado", "pendiente");
      setCanjesActius(count ?? 0);

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }
  if (!profile) return null;

  const totalCroquetas = profile.total_croquetas ?? 0;
  const tiradas = profile.tiradas_ruleta ?? 0;
  const tiradasPro = profile.tiradas_ruleta_pro ?? 0;
  const faltaNormal = 12 - (totalCroquetas % 12);
  const faltaPro = 100 - (totalCroquetas % 100);
  // Progrés: croquetes cap al proper múltiple de 12 (0..11 dins del cicle)
  const progresNormalPct = Math.round(((totalCroquetas % 12) / 12) * 100);
  const progresProPct = Math.round(((totalCroquetas % 100) / 100) * 100);

  const puedeGirar = tiradas > 0 || tiradasPro > 0;

  const siguientePremio = getSiguientePremio(profile.puntos_total, lang);

  return (
    <div className="space-y-6 py-6">
      {/* Saludo */}
      <div>
        <p className="text-sm text-oliva-600">{t.dashboard.welcome}</p>
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{profile.nombre}</h1>
      </div>

      {/* Tarjeta principal de puntos */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terracota-600 via-terracota-700 to-terracota-800 p-6 text-white md:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-crema-200/10 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="text-sm uppercase tracking-wider text-crema-100">{t.dashboard.yourPoints}</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="serif text-6xl font-semibold md:text-7xl">{profile.puntos_total}</span>
            <span className="mb-3 text-lg text-crema-100">{t.dashboard.points}</span>
          </div>
          {siguientePremio && (
            <p className="mt-3 text-sm text-crema-100">
              {tpl(t.qr.closeToReward, { reward: siguientePremio.nombre })} · {siguientePremio.faltan} {t.dashboard.points}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/rewards" className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-terracota-800 hover:bg-crema-50">
              {t.dashboard.viewRewards} →
            </Link>
            <Link href="/roulette" className="inline-flex items-center gap-1 rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              🎡 {t.dashboard.monthlyRoulette}
            </Link>
          </div>
        </div>
      </div>

      {/* Targeta de croquetes i progrés cap a tirades */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="serif text-xl text-terracota-800">🥟 {t.dashboard.croquetasTotal}</h2>
            <p className="mt-1 text-3xl font-semibold text-terracota-700">{totalCroquetas}</p>
          </div>
          <Link href="/roulette" className="rounded-full border border-terracota-200 px-4 py-2 text-sm text-terracota-700 hover:bg-terracota-50">
            🎡 {t.dashboard.monthlyRoulette} →
          </Link>
        </div>

        {/* Comptador de tirades */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-crema-50 p-3 text-center">
            <div className="text-xs uppercase text-oliva-600">🎡 {t.roulette.spinsNormal}</div>
            <div className="text-2xl font-bold text-terracota-700">{tiradas}</div>
          </div>
          <div className="rounded-xl bg-terracota-50 p-3 text-center">
            <div className="text-xs uppercase text-oliva-600">⭐ {t.roulette.spinsPro}</div>
            <div className="text-2xl font-bold text-terracota-800">{tiradasPro}</div>
          </div>
        </div>

        {/* Barra de progrés cap a la propera tirada normal */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-oliva-600">
            <span>{tpl(t.dashboard.nextSpinIn, { n: faltaNormal })}</span>
            <span>{totalCroquetas % 12}/12</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-crema-200">
            <div
              className="h-full bg-terracota-500 transition-all"
              style={{ width: `${progresNormalPct}%` }}
            />
          </div>
        </div>

        {/* Barra de progrés cap a la propera tirada PRO */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-oliva-600">
            <span>{tpl(t.dashboard.nextProInIn, { n: faltaPro })}</span>
            <span>{totalCroquetas % 100}/100</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-crema-200">
            <div
              className="h-full bg-gradient-to-r from-terracota-700 to-terracota-900 transition-all"
              style={{ width: `${progresProPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ruleta accés ràpid */}
      <Link href="/roulette" className="block">
        <div className={`card flex items-center justify-between transition hover:shadow-md ${!puedeGirar ? "opacity-70" : ""}`}>
          <div>
            <h2 className="serif text-xl text-terracota-800">🎡 {t.dashboard.monthlyRoulette}</h2>
            <p className="mt-1 text-sm text-oliva-700">
              {puedeGirar
                ? `${tpl(t.dashboard.spinsAvailable, { n: tiradas + tiradasPro })}`
                : t.roulette.noTiradas}
            </p>
          </div>
          <span className="text-2xl">{puedeGirar ? "→" : "✓"}</span>
        </div>
      </Link>

      {/* Els meus premis actius */}
      {canjesActius > 0 && (
        <Link href="/mis-premios" className="block">
          <div className="card flex items-center justify-between bg-gradient-to-r from-terracota-50 to-crema-50 transition hover:shadow-md">
            <div>
              <h2 className="serif text-xl text-terracota-800">🎁 {t.dashboard.myActivePrizes}</h2>
              <p className="mt-1 text-sm text-oliva-700">
                {tpl(t.dashboard.activePrizesCount, { n: canjesActius })}
              </p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </Link>
      )}

      {/* Taulell de títols (rangs desbloquejables) */}
      <TitlesGrid puntos={profile.puntos_total} />

      {/* Top 10 de fidels */}
      <RankingWidget />

      {/* Activitat recent */}
      <div className="card">
        <h2 className="serif mb-4 text-xl text-terracota-800">{t.dashboard.recentActivity}</h2>
        {movimientos.length === 0 ? (
          <p className="text-oliva-600">{t.dashboard.noActivity}</p>
        ) : (
          <ul className="divide-y divide-crema-200">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {m.tipo === "qr" ? "🎫" : m.tipo === "canje" ? "🎁" : m.tipo === "ruleta" ? "🎡" : "•"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{m.descripcion}</p>
                    <p className="text-xs text-oliva-600">
                      {new Date(m.created_at).toLocaleDateString(lang === "ca" ? "ca-ES" : "es-ES")}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${m.puntos >= 0 ? "text-oliva-600" : "text-terracota-600"}`}>
                  {m.puntos >= 0 ? "+" : ""}{m.puntos}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Banner per instal·lar com a PWA (només si no ho està ja) */}
      <InstallPWA />
    </div>
  );
}

function getSiguientePremio(puntos: number, lang: string) {
  const premios = [
    { p: 125, ca: "Cafè gratis", es: "Café gratis" },
    { p: 150, ca: "Copa de vi o canya", es: "Copa de vino o caña" },
    { p: 200, ca: "Postres gratis", es: "Postre gratis" },
    { p: 500, ca: "Menú de migdia gratis", es: "Menú de mediodía gratis" },
    { p: 750, ca: "Ampolla de vi de la casa", es: "Botella de vino de la casa" },
    { p: 1000, ca: "Arròs per a 2", es: "Arroz para 2" },
    { p: 2000, ca: "Sopar per a 2", es: "Cena para 2" },
    { p: 3000, ca: "Ganivet de cuina", es: "Cuchillo de cocina" },
  ];
  for (const pr of premios) {
    if (puntos < pr.p) {
      return { nombre: lang === "ca" ? pr.ca : pr.es, faltan: pr.p - puntos };
    }
  }
  return null;
}
