"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Canje {
  id: string;
  user_id: string;
  codigo_canje: string;
  estado: string;
  puntos_usados: number;
  created_at: string;
  premios: { nombre_es: string; nombre_ca: string } | null;
  profiles: { nombre: string; apellidos: string; email: string } | null;
}

export default function AdminRedemptionsPage() {
  const { t } = useI18n();
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [filtro, setFiltro] = useState<"pendiente" | "validado" | "rechazado" | "todos">("pendiente");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    const supa = createSupabaseBrowser();
    // IMPORTANT: canjes té dos FK a profiles (user_id i validado_por),
    // per això cal especificar explícitament "profiles!canjes_user_id_fkey"
    const { data, error } = await supa
      .from("canjes")
      .select(
        "id, user_id, codigo_canje, estado, puntos_usados, created_at, premios(nombre_es, nombre_ca), profiles!canjes_user_id_fkey(nombre, apellidos, email)"
      )
      .order("created_at", { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Error carregant canjes:", error);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    if (data) setCanjes(data as unknown as Canje[]);
  };

  const actualizar = async (id: string, estado: "validado" | "rechazado") => {
    const supa = createSupabaseBrowser();
    const { data: auth } = await supa.auth.getUser();
    await supa
      .from("canjes")
      .update({
        estado,
        validado_at: new Date().toISOString(),
        validado_por: auth.user?.id,
      })
      .eq("id", id);

    // Si se rechaza, devolver los puntos
    if (estado === "rechazado") {
      const c = canjes.find((x) => x.id === id);
      if (c && c.user_id) {
        const { data: prof } = await supa.from("profiles").select("puntos_total").eq("id", c.user_id).single();
        if (prof) {
          await supa
            .from("profiles")
            .update({ puntos_total: prof.puntos_total + c.puntos_usados })
            .eq("id", c.user_id);
          await supa.from("movimientos_puntos").insert({
            user_id: c.user_id,
            puntos: c.puntos_usados,
            tipo: "ajuste_admin",
            descripcion: `Devolución por canje rechazado: ${c.codigo_canje}`,
          });
        }
      }
    }
    cargar();
  };

  const busquedaNorm = busqueda.trim().toUpperCase();
  const filtradosPorEstado = canjes.filter((c) => filtro === "todos" || c.estado === filtro);
  const filtrados = busquedaNorm
    ? filtradosPorEstado.filter((c) => c.codigo_canje.toUpperCase().includes(busquedaNorm))
    : filtradosPorEstado;
  const matchExacte = busquedaNorm
    ? canjes.find((c) => c.codigo_canje.toUpperCase() === busquedaNorm)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="serif text-3xl text-terracota-800">{t.admin.redemptions}</h1>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Error carregant canjes: {loadError}
        </div>
      )}

      {/* Cercador de codi */}
      <div className="card">
        <label className="block text-sm font-medium text-oliva-800">{t.admin.searchCode}</label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
            placeholder={t.admin.enterCode}
            className="flex-1 rounded-xl border border-oliva-200 bg-white px-4 py-2 font-mono text-lg uppercase tracking-wider focus:border-terracota-500 focus:outline-none"
            autoComplete="off"
            autoCapitalize="characters"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="rounded-xl border border-oliva-200 bg-white px-4 py-2 text-sm text-oliva-700 hover:bg-oliva-50"
            >
              {t.admin.clearSearch}
            </button>
          )}
        </div>
        {busquedaNorm && (
          <p className="mt-2 text-xs text-oliva-600">
            {matchExacte
              ? `${t.admin.codeFound}: ${matchExacte.codigo_canje} · ${matchExacte.estado}`
              : filtrados.length === 0
              ? t.admin.noMatch
              : `${filtrados.length} resultats`}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { k: "pendiente", l: "Pendientes" },
          { k: "validado", l: "Validados" },
          { k: "rechazado", l: "Rechazados" },
          { k: "todos", l: "Todos" },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltro(f.k as any)}
            className={`rounded-full px-4 py-2 text-sm ${
              filtro === f.k
                ? "bg-terracota-600 text-white"
                : "border border-oliva-200 bg-white text-oliva-800"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-crema-200 text-left text-oliva-700">
              <th className="py-2">{t.admin.code}</th>
              <th className="py-2">{t.admin.client}</th>
              <th className="py-2">{t.admin.reward}</th>
              <th className="py-2">Puntos</th>
              <th className="py-2">{t.admin.date}</th>
              <th className="py-2">Estado</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => {
              const esMatch = matchExacte?.id === c.id;
              return (
              <tr key={c.id} className={`border-b border-crema-100 ${esMatch ? "bg-yellow-50 ring-2 ring-yellow-300" : ""}`}>
                <td className="py-2 font-mono font-bold text-terracota-700">{c.codigo_canje}</td>
                <td className="py-2">
                  {c.profiles?.nombre} {c.profiles?.apellidos}
                  <br />
                  <span className="text-xs text-oliva-600">{c.profiles?.email}</span>
                </td>
                <td className="py-2">{c.premios?.nombre_es}</td>
                <td className="py-2 font-semibold">{c.puntos_usados}</td>
                <td className="py-2 text-xs text-oliva-600">
                  {new Date(c.created_at).toLocaleString("es-ES")}
                </td>
                <td className="py-2">
                  <span className={
                    c.estado === "validado" ? "text-oliva-600" :
                    c.estado === "rechazado" ? "text-red-600" : "text-terracota-600"
                  }>
                    {c.estado}
                  </span>
                </td>
                <td className="py-2">
                  {c.estado === "pendiente" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => actualizar(c.id, "validado")}
                        autoFocus={esMatch && c.estado === "pendiente"}
                        className={`rounded px-2 py-1 text-xs text-white ${
                          esMatch ? "bg-oliva-700 ring-2 ring-oliva-800" : "bg-oliva-600 hover:bg-oliva-700"
                        }`}
                      >
                        ✓ {t.admin.validate}
                      </button>
                      <button onClick={() => actualizar(c.id, "rechazado")} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                        ✗
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-oliva-600">Sin canjes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
