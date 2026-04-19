"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

export default function AdminStatsPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState({
    clientes: 0,
    suscritos: 0,
    puntosEmitidos: 0,
    puntosCanjeados: 0,
    canjesPendientes: 0,
    canjesValidados: 0,
    qrGenerados: 0,
    qrUsados: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supa = createSupabaseBrowser();
      const [c, s, mp, mc, cp, cv, qg, qu] = await Promise.all([
        supa.from("profiles").select("*", { count: "exact", head: true }),
        supa.from("profiles").select("*", { count: "exact", head: true }).eq("acepta_promociones", true),
        supa.from("movimientos_puntos").select("puntos").gt("puntos", 0),
        supa.from("movimientos_puntos").select("puntos").lt("puntos", 0),
        supa.from("canjes").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
        supa.from("canjes").select("*", { count: "exact", head: true }).eq("estado", "validado"),
        supa.from("qr_codes").select("*", { count: "exact", head: true }),
        supa.from("qr_codes").select("*", { count: "exact", head: true }).eq("usado", true),
      ]);

      const sumPos = (mp.data || []).reduce((a: number, m: any) => a + m.puntos, 0);
      const sumNeg = (mc.data || []).reduce((a: number, m: any) => a + Math.abs(m.puntos), 0);

      setStats({
        clientes: c.count || 0,
        suscritos: s.count || 0,
        puntosEmitidos: sumPos,
        puntosCanjeados: sumNeg,
        canjesPendientes: cp.count || 0,
        canjesValidados: cv.count || 0,
        qrGenerados: qg.count || 0,
        qrUsados: qu.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-20 text-center">{t.common.loading}</div>;

  const cards = [
    { label: t.admin.statsTotalClients, value: stats.clientes, icon: "👥", color: "terracota" },
    { label: "Suscritos a newsletter", value: stats.suscritos, icon: "📧", color: "oliva" },
    { label: t.admin.statsPointsIssued, value: stats.puntosEmitidos, icon: "⭐", color: "terracota" },
    { label: "Puntos canjeados", value: stats.puntosCanjeados, icon: "🎁", color: "oliva" },
    { label: "Canjes pendientes", value: stats.canjesPendientes, icon: "⏳", color: "terracota" },
    { label: "Canjes validados", value: stats.canjesValidados, icon: "✓", color: "oliva" },
    { label: t.admin.statsQrGenerated, value: stats.qrGenerados, icon: "🎫", color: "terracota" },
    { label: "QR usados", value: stats.qrUsados, icon: "✓", color: "oliva" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="serif text-3xl text-terracota-800">{t.admin.stats}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-2xl">{c.icon}</div>
            <p className="mt-1 text-xs text-oliva-600">{c.label}</p>
            <p className={`serif mt-1 text-3xl font-semibold text-${c.color}-700`}>
              {c.value.toLocaleString("es-ES")}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="serif mb-3 text-xl text-terracota-800">Tasa de conversión QR</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 overflow-hidden rounded-full bg-oliva-100">
              <div
                className="h-full bg-terracota-500"
                style={{ width: `${stats.qrGenerados > 0 ? (stats.qrUsados / stats.qrGenerados) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="font-semibold">
            {stats.qrGenerados > 0 ? Math.round((stats.qrUsados / stats.qrGenerados) * 100) : 0}%
          </span>
        </div>
        <p className="mt-2 text-sm text-oliva-700">
          {stats.qrUsados} de {stats.qrGenerados} QR generados han sido reclamados por clientes.
        </p>
      </div>
    </div>
  );
}
