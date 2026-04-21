"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Premio {
  id: string;
  nombre_ca: string;
  nombre_es: string;
  descripcion_ca: string | null;
  descripcion_es: string | null;
  puntos_necesarios: number;
  orden: number;
}

// Mostrem el catàleg de premis públics (els que tenen activo=true).
// La política RLS `everyone_select_premios` permet llegir-los sense
// estar autenticat, així que aquest component es pot fer servir a la
// pàgina de login per atreure registres.
export function PremiosPreview() {
  const { t, lang } = useI18n();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa
      .from("premios")
      .select("id, nombre_ca, nombre_es, descripcion_ca, descripcion_es, puntos_necesarios, orden")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("puntos_necesarios", { ascending: true })
      .then(({ data }) => {
        if (data) setPremios(data as Premio[]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-crema-200 bg-white p-6 text-center text-sm text-oliva-600">
        {t.common.loading}
      </div>
    );
  }

  if (premios.length === 0) return null;

  return (
    <div className="rounded-2xl border border-crema-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="serif text-xl text-terracota-800">🎁 {t.premiosPreview.title}</h2>
        <p className="text-sm text-oliva-700">{t.premiosPreview.subtitle}</p>
      </div>

      <ul className="divide-y divide-crema-200">
        {premios.map((p) => {
          const nombre = lang === "ca" ? p.nombre_ca : p.nombre_es;
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-oliva-900">{nombre}</span>
              <span className="shrink-0 rounded-full bg-terracota-50 px-2.5 py-1 text-xs font-semibold text-terracota-700">
                {p.puntos_necesarios} {t.dashboard.points}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center text-xs text-oliva-600">
        {t.premiosPreview.footer}
      </p>
    </div>
  );
}
