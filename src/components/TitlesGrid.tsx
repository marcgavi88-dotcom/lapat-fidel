"use client";

import { useI18n, tpl } from "@/i18n/provider";

interface Props {
  puntos: number;
}

interface Title {
  key: keyof typeof TITLE_KEYS;
  points: number;
  icon: string;
}

// Claus que s'han de correspondre amb les entrades de `titulos` a ca.ts / es.ts
const TITLE_KEYS = {
  r0: true,
  r50: true,
  r150: true,
  r300: true,
  r600: true,
  r1000: true,
  r2000: true,
  r3500: true,
  r5000: true,
} as const;

const TITLES: Title[] = [
  { key: "r0", points: 0, icon: "🌱" },
  { key: "r50", points: 50, icon: "🍽️" },
  { key: "r150", points: 150, icon: "😋" },
  { key: "r300", points: 300, icon: "🍲" },
  { key: "r600", points: 600, icon: "🥘" },
  { key: "r1000", points: 1000, icon: "⭐" },
  { key: "r2000", points: 2000, icon: "🍷" },
  { key: "r3500", points: 3500, icon: "👑" },
  { key: "r5000", points: 5000, icon: "🏆" },
];

export default function TitlesGrid({ puntos }: Props) {
  const { t } = useI18n();

  // Títol actual: el més alt amb points <= puntos
  let currentIdx = 0;
  for (let i = TITLES.length - 1; i >= 0; i--) {
    if (puntos >= TITLES[i].points) {
      currentIdx = i;
      break;
    }
  }
  const current = TITLES[currentIdx];
  const next = currentIdx < TITLES.length - 1 ? TITLES[currentIdx + 1] : null;

  return (
    <div className="card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="serif text-xl text-terracota-800">🏅 {t.dashboard.titles}</h2>
          <p className="text-xs text-oliva-600">{t.dashboard.titlesSubtitle}</p>
        </div>
      </div>

      {/* Títol actual + següent */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-terracota-50 to-crema-50 p-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{current.icon}</span>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-oliva-600">
              {t.dashboard.titleCurrent}
            </p>
            <p className="serif text-lg font-semibold text-terracota-800">
              {t.titulos[current.key]}
            </p>
          </div>
        </div>
        {next && (
          <p className="mt-2 text-xs text-oliva-700">
            {tpl(t.dashboard.titleNextAt, { points: next.points })} · {next.icon}{" "}
            <span className="font-medium">{t.titulos[next.key]}</span>
          </p>
        )}
      </div>

      {/* Graella 3x3 */}
      <div className="grid grid-cols-3 gap-2">
        {TITLES.map((title, idx) => {
          const unlocked = puntos >= title.points;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={title.key}
              className={`relative flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                isCurrent
                  ? "border-terracota-400 bg-terracota-50 shadow-sm ring-2 ring-terracota-300"
                  : unlocked
                  ? "border-oliva-200 bg-crema-50"
                  : "border-crema-200 bg-white opacity-60"
              }`}
            >
              <span className={`text-2xl ${unlocked ? "" : "grayscale"}`}>
                {unlocked ? title.icon : "🔒"}
              </span>
              <p
                className={`mt-1 line-clamp-2 text-[11px] font-medium leading-tight ${
                  unlocked ? "text-terracota-800" : "text-oliva-500"
                }`}
              >
                {t.titulos[title.key]}
              </p>
              <p className="mt-0.5 text-[10px] text-oliva-500">
                {title.points === 0 ? "—" : `${title.points} pts`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
