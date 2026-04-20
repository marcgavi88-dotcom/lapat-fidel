"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface RankRow {
  rang: number;
  nom_display: string;
  puntos_total: number;
  is_me: boolean;
}

interface MyRank {
  rang: number;
  puntos_total: number;
}

export default function RankingWidget() {
  const { t } = useI18n();
  const [top, setTop] = useState<RankRow[]>([]);
  const [me, setMe] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      try {
        const [topRes, meRes] = await Promise.all([
          supa.rpc("get_ranking_top", { p_limit: 10 }),
          supa.rpc("get_my_ranking"),
        ]);
        if (topRes.error) throw topRes.error;
        if (meRes.error) throw meRes.error;
        setTop((topRes.data as RankRow[]) ?? []);
        const myArr = (meRes.data as MyRank[]) ?? [];
        setMe(myArr.length > 0 ? myArr[0] : null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h2 className="serif text-xl text-terracota-800">🏆 {t.dashboard.ranking}</h2>
        <p className="mt-3 text-sm text-oliva-600">{t.common.loading}</p>
      </div>
    );
  }

  // Si la RPC no existeix encara (migració no aplicada), amaga el widget silenciosament
  if (error) {
    return null;
  }

  const meInTop = top.some((r) => r.is_me);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="serif text-xl text-terracota-800">🏆 {t.dashboard.ranking}</h2>
          <p className="text-xs text-oliva-600">{t.dashboard.rankingSubtitle}</p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="py-4 text-center text-sm text-oliva-600">{t.dashboard.rankingEmpty}</p>
      ) : (
        <ol className="divide-y divide-crema-200">
          {top.map((r) => {
            const medal =
              r.rang === 1 ? "🥇" : r.rang === 2 ? "🥈" : r.rang === 3 ? "🥉" : null;
            return (
              <li
                key={r.rang}
                className={`flex items-center justify-between gap-3 py-2 ${
                  r.is_me ? "rounded-lg bg-terracota-50 px-2" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-sm font-semibold text-oliva-700">
                    {medal ?? `#${r.rang}`}
                  </span>
                  <span
                    className={`truncate text-sm ${
                      r.is_me ? "font-semibold text-terracota-800" : "text-oliva-900"
                    }`}
                  >
                    {r.nom_display}
                    {r.is_me && (
                      <span className="ml-1 rounded-full bg-terracota-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {t.dashboard.rankingYou}
                      </span>
                    )}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    r.is_me ? "text-terracota-800" : "text-terracota-700"
                  }`}
                >
                  {r.puntos_total}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Posició pròpia si està fora del top */}
      {me && !meInTop && (
        <div className="mt-3 rounded-lg bg-crema-50 px-3 py-2 text-center text-xs text-oliva-700">
          {tpl(t.dashboard.rankingYourPos, { n: me.rang })} · {me.puntos_total} pts
        </div>
      )}
      {!me && top.length > 0 && (
        <div className="mt-3 rounded-lg bg-crema-50 px-3 py-2 text-center text-xs text-oliva-600">
          {t.dashboard.rankingOutOfTop}
        </div>
      )}
    </div>
  );
}
