"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface Profile {
  id: string;
  nombre: string;
  apellidos: string;
  puntos_total: number;
  puntos_menu: number;
  ultimo_giro_ruleta: string | null;
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
        .select("id, nombre, apellidos, puntos_total, puntos_menu, ultimo_giro_ruleta")
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
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }
  if (!profile) return null;

  // Tarjeta de sellos: 10 sellos = 250 puntos (25 por menú)
  const sellosCompletos = Math.min(10, Math.floor(profile.puntos_menu / 25));
  const progresoMenu = profile.puntos_menu % 250;

  // Ruleta: comprueba si ya giró este mes
  const puedeGirar = !profile.ultimo_giro_ruleta ||
    new Date(profile.ultimo_giro_ruleta).getMonth() !== new Date().getMonth() ||
    new Date(profile.ultimo_giro_ruleta).getFullYear() !== new Date().getFullYear();

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

      {/* Tarjeta de sellos (menú del día) */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="serif text-xl text-terracota-800">{t.dashboard.menuCard}</h2>
          <span className="text-sm text-oliva-600">{progresoMenu}/250</span>
        </div>
        <p className="mb-4 text-sm text-oliva-700">{t.dashboard.menuCardDesc}</p>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => {
            const isFull = i < sellosCompletos;
            const isLast = i === 9;
            return (
              <div
                key={i}
                className={`relative flex aspect-square items-center justify-center rounded-full border-2 text-sm font-semibold transition ${
                  isFull
                    ? isLast
                      ? "border-terracota-600 bg-terracota-600 text-white"
                      : "border-oliva-500 bg-oliva-500 text-white"
                    : "border-dashed border-oliva-300 bg-crema-50 text-oliva-400"
                }`}
              >
                {isLast ? "🎁" : isFull ? "✓" : i + 1}
              </div>
            );
          })}
        </div>

        {/* Barra progreso hasta próximo sello */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-oliva-100">
            <div
              className="h-full bg-terracota-500 transition-all"
              style={{ width: `${(progresoMenu / 250) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ruleta acceso rápido */}
      <Link href="/roulette" className="block">
        <div className={`card flex items-center justify-between transition hover:shadow-md ${!puedeGirar ? "opacity-70" : ""}`}>
          <div>
            <h2 className="serif text-xl text-terracota-800">🎡 {t.dashboard.monthlyRoulette}</h2>
            <p className="mt-1 text-sm text-oliva-700">
              {puedeGirar ? t.dashboard.spinNow : t.dashboard.alreadySpun}
            </p>
          </div>
          <span className="text-2xl">{puedeGirar ? "→" : "✓"}</span>
        </div>
      </Link>

      {/* Actividad reciente */}
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
    </div>
  );
}

function getSiguientePremio(puntos: number, lang: string) {
  const premios = [
    { p: 125, ca: "Cafè gratis", es: "Café gratis" },
    { p: 200, ca: "Postres gratis", es: "Postre gratis" },
    { p: 500, ca: "Menú de migdia gratis", es: "Menú de mediodía gratis" },
    { p: 1000, ca: "Arròs per a 2", es: "Arroz para 2" },
    { p: 2000, ca: "Sopar per a 2", es: "Cena para 2" },
    { p: 2500, ca: "Ganivet de cuina", es: "Cuchillo de cocina" },
  ];
  for (const pr of premios) {
    if (puntos < pr.p) {
      return { nombre: lang === "ca" ? pr.ca : pr.es, faltan: pr.p - puntos };
    }
  }
  return null;
}
