"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

const SEGMENTOS = [
  { key: "15_puntos", label: "+15", color: "#c95f33" },
  { key: "10_puntos", label: "+10", color: "#789147" },
  { key: "25_puntos", label: "+25", color: "#b24a28" },
  { key: "cafe_gratis", label: "☕", color: "#3a7a8c" },
  { key: "15_puntos", label: "+15", color: "#e08050" },
  { key: "50_puntos", label: "+50", color: "#e9c988" },
  { key: "postre_gratis", label: "🍰", color: "#933924" },
  { key: "15_puntos", label: "+15", color: "#97ad5f" },
];

export default function RoulettePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [puedeGirar, setPuedeGirar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [resultado, setResultado] = useState<{ premio: string; puntos: number; codigo?: string } | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    (async () => {
      const supa = createSupabaseBrowser();
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supa
        .from("profiles")
        .select("ultimo_giro_ruleta")
        .eq("id", auth.user.id)
        .single();

      const ult = data?.ultimo_giro_ruleta;
      const puede = !ult ||
        new Date(ult).getMonth() !== new Date().getMonth() ||
        new Date(ult).getFullYear() !== new Date().getFullYear();
      setPuedeGirar(puede);
      setLoading(false);
    })();
  }, [router]);

  const handleSpin = async () => {
    if (!puedeGirar || spinning) return;
    setSpinning(true);

    try {
      const res = await fetch("/api/roulette", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        alert(t.common.error);
        setSpinning(false);
        return;
      }

      // Calcular el ángulo de rotación para que pare en el segmento correcto
      const idx = SEGMENTOS.findIndex((s) => s.key === json.premio);
      const segmentIdx = idx >= 0 ? idx : 0;
      const degPorSegmento = 360 / SEGMENTOS.length;
      const targetDeg = 360 - segmentIdx * degPorSegmento - degPorSegmento / 2;
      const totalDeg = 360 * 6 + targetDeg; // 6 vueltas completas + posición

      setRotation(totalDeg);

      // Esperar animación (4 segundos) antes de mostrar resultado
      setTimeout(() => {
        setResultado({
          premio: json.premio,
          puntos: json.puntos,
          codigo: json.codigo_canje,
        });
        setSpinning(false);
        setPuedeGirar(false);
      }, 4200);
    } catch {
      alert(t.common.error);
      setSpinning(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;

  const premioTexto = (key: string): string => {
    const map: Record<string, { ca: string; es: string }> = {
      "10_puntos": { ca: "10 punts extra!", es: "¡10 puntos extra!" },
      "15_puntos": { ca: "15 punts extra!", es: "¡15 puntos extra!" },
      "25_puntos": { ca: "25 punts extra!", es: "¡25 puntos extra!" },
      "50_puntos": { ca: "50 punts extra!", es: "¡50 puntos extra!" },
      cafe_gratis: { ca: "Cafè gratis!", es: "¡Café gratis!" },
      postre_gratis: { ca: "Postres gratis!", es: "¡Postre gratis!" },
    };
    return lang === "ca" ? map[key]?.ca ?? key : map[key]?.es ?? key;
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.roulette.title}</h1>
        <p className="mt-2 text-oliva-700">{t.roulette.subtitle}</p>

        {/* Ruleta SVG */}
        <div className="relative mx-auto my-10 h-80 w-80 md:h-96 md:w-96">
          {/* Flecha indicadora */}
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2">
            <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
              <path d="M17 44L2 14C2 7 9 2 17 2C25 2 32 7 32 14L17 44Z" fill="#c95f33" stroke="#fff" strokeWidth="3" />
            </svg>
          </div>

          {/* Rueda */}
          <div
            ref={wheelRef}
            className="h-full w-full rounded-full border-[6px] border-terracota-700 shadow-xl transition-transform"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.32, 0.98)" : "none",
            }}
          >
            <svg viewBox="0 0 200 200" className="h-full w-full">
              {SEGMENTOS.map((seg, i) => {
                const angle = 360 / SEGMENTOS.length;
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
              {/* Círculo central */}
              <circle cx="100" cy="100" r="14" fill="#fdfaf3" stroke="#c95f33" strokeWidth="3" />
            </svg>
          </div>
        </div>

        {/* Botón o mensaje */}
        {resultado ? (
          <div className="card mx-auto max-w-sm">
            <div className="mb-3 text-5xl">🎉</div>
            <h2 className="serif text-2xl text-terracota-800">{t.roulette.youWon}</h2>
            <p className="mt-2 text-lg font-medium text-terracota-700">{premioTexto(resultado.premio)}</p>
            {resultado.codigo && (
              <>
                <p className="mt-4 text-sm text-oliva-700">{t.roulette.freeCode}</p>
                <div className="my-3 rounded-xl bg-terracota-50 px-6 py-3 font-mono text-3xl font-bold tracking-wider text-terracota-700">
                  {resultado.codigo}
                </div>
              </>
            )}
            <button onClick={() => router.push("/dashboard")} className="btn-primary mt-4 w-full">
              {t.nav.dashboard}
            </button>
          </div>
        ) : puedeGirar ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="btn-primary mx-auto text-xl !px-10 !py-4 shadow-lg"
          >
            {spinning ? t.roulette.spinning : t.roulette.spin}
          </button>
        ) : (
          <div className="card mx-auto max-w-sm">
            <p className="text-oliva-700">{t.roulette.alreadySpun}</p>
          </div>
        )}
      </div>
    </div>
  );
}
