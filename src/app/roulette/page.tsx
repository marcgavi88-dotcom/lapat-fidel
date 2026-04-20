"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

type TipoRuleta = "normal" | "pro";

interface Segmento {
  key: string;
  label: string;
  color: string;
}

// Segments de la Ruleta Normal (10 posicions)
const SEG_NORMAL: Segmento[] = [
  { key: "15_puntos", label: "+15", color: "#c95f33" },
  { key: "10_puntos", label: "+10", color: "#789147" },
  { key: "25_puntos", label: "+25", color: "#b24a28" },
  { key: "cafe_gratis", label: "☕", color: "#3a7a8c" },
  { key: "15_puntos", label: "+15", color: "#e08050" },
  { key: "50_puntos", label: "+50", color: "#e9c988" },
  { key: "copa_gratis", label: "🍷", color: "#933924" },
  { key: "10_puntos", label: "+10", color: "#97ad5f" },
  { key: "25_puntos", label: "+25", color: "#d97646" },
  { key: "5_puntos", label: "+5", color: "#a8764a" },
];

// Segments de la Ruleta PRO (8 posicions, tot canjeable)
const SEG_PRO: Segmento[] = [
  { key: "cafe_gratis", label: "☕", color: "#3a7a8c" },
  { key: "copa_gratis", label: "🍷", color: "#933924" },
  { key: "cafe_gratis", label: "☕", color: "#4a8f9c" },
  { key: "postre_gratis", label: "🍰", color: "#c95f33" },
  { key: "cafe_gratis", label: "☕", color: "#2e6a7c" },
  { key: "copa_gratis", label: "🍷", color: "#b24a28" },
  { key: "cafe_gratis", label: "☕", color: "#3a7a8c" },
  { key: "menu_gratis", label: "🍽️", color: "#e9c988" },
];

function premiTextos(lang: "ca" | "es", key: string): string {
  const map: Record<string, { ca: string; es: string }> = {
    "5_puntos": { ca: "5 punts extra!", es: "¡5 puntos extra!" },
    "10_puntos": { ca: "10 punts extra!", es: "¡10 puntos extra!" },
    "15_puntos": { ca: "15 punts extra!", es: "¡15 puntos extra!" },
    "25_puntos": { ca: "25 punts extra!", es: "¡25 puntos extra!" },
    "50_puntos": { ca: "50 punts extra!", es: "¡50 puntos extra!" },
    cafe_gratis: { ca: "Cafè gratis!", es: "¡Café gratis!" },
    copa_gratis: { ca: "Canya o copa de vi gratis!", es: "¡Caña o copa de vino gratis!" },
    postre_gratis: { ca: "Postres gratis!", es: "¡Postre gratis!" },
    menu_gratis: { ca: "MENÚ DEL MIGDIA GRATIS!", es: "¡MENÚ DEL DÍA GRATIS!" },
  };
  return lang === "ca" ? map[key]?.ca ?? key : map[key]?.es ?? key;
}

export default function RoulettePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [tipoActivo, setTipoActivo] = useState<TipoRuleta>("normal");
  const [tiradas, setTiradas] = useState(0);
  const [tiradasPro, setTiradasPro] = useState(0);
  const [totalCroquetas, setTotalCroquetas] = useState(0);
  const [resultado, setResultado] = useState<{ premio: string; puntos: number; codigo?: string } | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);

  const segmentos = tipoActivo === "pro" ? SEG_PRO : SEG_NORMAL;

  const cargar = async () => {
    const supa = createSupabaseBrowser();
    const { data: auth } = await supa.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }
    const { data } = await supa
      .from("profiles")
      .select("tiradas_ruleta, tiradas_ruleta_pro, total_croquetas")
      .eq("id", auth.user.id)
      .single();
    if (data) {
      setTiradas(data.tiradas_ruleta ?? 0);
      setTiradasPro(data.tiradas_ruleta_pro ?? 0);
      setTotalCroquetas(data.total_croquetas ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puedeGirar =
    tipoActivo === "pro" ? tiradasPro > 0 : tiradas > 0;

  const handleSpin = async () => {
    if (!puedeGirar || spinning) return;
    setSpinning(true);
    setResultado(null);

    try {
      const res = await fetch("/api/roulette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipoActivo }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error || t.common.error);
        setSpinning(false);
        return;
      }

      // Calcular l'angle de rotació perquè pari al segment correcte
      const idx = segmentos.findIndex((s) => s.key === json.premio);
      const segmentIdx = idx >= 0 ? idx : 0;
      const degPorSegmento = 360 / segmentos.length;
      const targetDeg = 360 - segmentIdx * degPorSegmento - degPorSegmento / 2;
      const totalDeg = 360 * 6 + targetDeg;

      setRotation(totalDeg);

      // Esperar animació (4 segons) abans de mostrar resultat
      setTimeout(() => {
        setResultado({
          premio: json.premio,
          puntos: json.puntos,
          codigo: json.codigo_canje,
        });
        setSpinning(false);
        // Decrementar localment per reflectir la tirada consumida
        if (tipoActivo === "pro") setTiradasPro((n) => Math.max(0, n - 1));
        else setTiradas((n) => Math.max(0, n - 1));
      }, 4200);
    } catch {
      alert(t.common.error);
      setSpinning(false);
    }
  };

  const handleCambiarTipo = (nuevoTipo: TipoRuleta) => {
    if (spinning) return;
    setTipoActivo(nuevoTipo);
    setResultado(null);
    setRotation(0);
  };

  if (loading) return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;

  const faltaNormal = 12 - (totalCroquetas % 12);
  const faltaPro = 100 - (totalCroquetas % 100);

  return (
    <div className="py-6">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.roulette.title}</h1>
        <p className="mt-2 text-oliva-700">{t.roulette.subtitle}</p>

        {/* Comptador de croquetes i tirades */}
        <div className="card mx-auto mt-4 max-w-md">
          <div className="flex items-center justify-around gap-3 text-sm">
            <div>
              <div className="text-2xl">🥟</div>
              <div className="font-semibold text-terracota-800">{totalCroquetas}</div>
              <div className="text-xs text-oliva-600">{t.dashboard.croquetasTotal}</div>
            </div>
            <div>
              <div className="text-2xl">🎡</div>
              <div className="font-semibold text-terracota-800">{tiradas}</div>
              <div className="text-xs text-oliva-600">{t.roulette.spinsNormal}</div>
            </div>
            <div>
              <div className="text-2xl">⭐</div>
              <div className="font-semibold text-terracota-800">{tiradasPro}</div>
              <div className="text-xs text-oliva-600">{t.roulette.spinsPro}</div>
            </div>
          </div>
        </div>

        {/* Selector de tipus */}
        <div className="mx-auto my-5 inline-flex rounded-full border border-terracota-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => handleCambiarTipo("normal")}
            disabled={spinning}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tipoActivo === "normal"
                ? "bg-terracota-600 text-white shadow"
                : "text-terracota-700 hover:bg-terracota-50"
            }`}
          >
            🎡 {t.roulette.normalMode}
          </button>
          <button
            onClick={() => handleCambiarTipo("pro")}
            disabled={spinning}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tipoActivo === "pro"
                ? "bg-gradient-to-r from-terracota-700 to-terracota-900 text-white shadow"
                : "text-terracota-700 hover:bg-terracota-50"
            }`}
          >
            ⭐ {t.roulette.proMode}
          </button>
        </div>

        {tipoActivo === "pro" && (
          <p className="mx-auto -mt-2 mb-3 max-w-sm text-sm text-oliva-700">
            {t.roulette.proDescription}
          </p>
        )}

        {/* Ruleta SVG */}
        <div className="relative mx-auto my-6 h-80 w-80 md:h-96 md:w-96">
          {/* Fletxa indicadora */}
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2">
            <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
              <path d="M17 44L2 14C2 7 9 2 17 2C25 2 32 7 32 14L17 44Z" fill="#c95f33" stroke="#fff" strokeWidth="3" />
            </svg>
          </div>

          {/* Rueda */}
          <div
            ref={wheelRef}
            className={`h-full w-full rounded-full shadow-xl transition-transform ${
              tipoActivo === "pro"
                ? "border-[8px] border-terracota-900 ring-4 ring-terracota-200"
                : "border-[6px] border-terracota-700"
            }`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.32, 0.98)" : "none",
            }}
          >
            <svg viewBox="0 0 200 200" className="h-full w-full">
              {segmentos.map((seg, i) => {
                const angle = 360 / segmentos.length;
                const startAngle = i * angle - 90;
                const endAngle = (i + 1) * angle - 90;
                const x1 = 100 + 100 * Math.cos((startAngle * Math.PI) / 180);
                const y1 = 100 + 100 * Math.sin((startAngle * Math.PI) / 180);
                const x2 = 100 + 100 * Math.cos((endAngle * Math.PI) / 180);
                const y2 = 100 + 100 * Math.sin((endAngle * Math.PI) / 180);
                const largeArc = angle > 180 ? 1 : 0;
                const midAngle = startAngle + angle / 2;
                const tx = 100 + 60 * Math.cos((midAngle * Math.PI) / 180);
                const ty = 100 + 60 * Math.sin((midAngle * Math.PI) / 180);
                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={seg.color}
                      stroke="#fff"
                      strokeWidth="1"
                    />
                    <text
                      x={tx}
                      y={ty}
                      fontSize="16"
                      fontWeight="bold"
                      fill="white"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="14" fill="#fdfaf3" stroke="#c95f33" strokeWidth="3" />
            </svg>
          </div>
        </div>

        {/* Botó o missatge */}
        {resultado ? (
          <div className="card mx-auto max-w-sm">
            <div className="mb-3 text-5xl">🎉</div>
            <h2 className="serif text-2xl text-terracota-800">{t.roulette.youWon}</h2>
            <p className="mt-2 text-lg font-medium text-terracota-700">
              {premiTextos(lang, resultado.premio)}
            </p>
            {resultado.codigo && (
              <>
                <p className="mt-4 text-sm text-oliva-700">{t.roulette.freeCode}</p>
                <div className="my-3 rounded-xl bg-terracota-50 px-6 py-3 font-mono text-3xl font-bold tracking-wider text-terracota-700">
                  {resultado.codigo}
                </div>
              </>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {puedeGirar && (
                <button
                  onClick={() => {
                    setResultado(null);
                    setRotation(0);
                  }}
                  className="btn-primary w-full"
                >
                  {t.roulette.spin}
                </button>
              )}
              <button onClick={() => router.push("/dashboard")} className="btn-secondary w-full">
                {t.roulette.backToDashboard}
              </button>
            </div>
          </div>
        ) : puedeGirar ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className={`mx-auto text-xl shadow-lg ${
              tipoActivo === "pro"
                ? "rounded-full bg-gradient-to-r from-terracota-700 to-terracota-900 px-10 py-4 font-semibold text-white hover:shadow-xl disabled:opacity-60"
                : "btn-primary !px-10 !py-4"
            }`}
          >
            {spinning ? t.roulette.spinning : tipoActivo === "pro" ? t.roulette.spinPro : t.roulette.spin}
          </button>
        ) : (
          <div className="card mx-auto max-w-sm">
            {tipoActivo === "pro" ? (
              <>
                <p className="text-oliva-700">{t.roulette.noTiradasPro}</p>
                <p className="mt-2 text-sm text-oliva-600">
                  {tpl(t.dashboard.nextProInIn, { n: faltaPro })}
                </p>
              </>
            ) : (
              <>
                <p className="text-oliva-700">{t.roulette.noTiradas}</p>
                <p className="mt-2 text-sm text-oliva-600">
                  {tpl(t.dashboard.nextSpinIn, { n: faltaNormal })}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
