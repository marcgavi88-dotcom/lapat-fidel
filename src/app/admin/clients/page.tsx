"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Cliente {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  puntos_total: number;
  puntos_menu: number;
  acepta_promociones: boolean;
  created_at: string;
}

interface Movimiento {
  id: string;
  puntos: number;
  tipo: string;
  descripcion: string;
  created_at: string;
}

export default function AdminClientsPage() {
  const { t } = useI18n();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    const supa = createSupabaseBrowser();
    const { data } = await supa
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setClientes(data);
  };

  const verDetalle = async (c: Cliente) => {
    setSeleccionado(c);
    const supa = createSupabaseBrowser();
    const { data } = await supa
      .from("movimientos_puntos")
      .select("*")
      .eq("user_id", c.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setMovimientos(data);
  };

  const filtrados = clientes.filter((c) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.apellidos.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.telefono?.includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="serif text-3xl text-terracota-800">{t.admin.clients}</h1>
        <span className="rounded-full bg-oliva-100 px-4 py-1 text-sm text-oliva-800">
          {t.admin.totalClients}: {clientes.length}
        </span>
      </div>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={t.admin.searchClient}
        className="input-field"
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-crema-200 text-left text-oliva-700">
              <th className="py-2">Nombre</th>
              <th className="py-2">Email</th>
              <th className="py-2">Teléfono</th>
              <th className="py-2">Puntos</th>
              <th className="py-2">Promos</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} className="border-b border-crema-100">
                <td className="py-2 font-medium">{c.nombre} {c.apellidos}</td>
                <td className="py-2 text-oliva-700">{c.email}</td>
                <td className="py-2 text-oliva-700">{c.telefono || "—"}</td>
                <td className="py-2 font-semibold text-terracota-700">{c.puntos_total}</td>
                <td className="py-2">{c.acepta_promociones ? "✓" : "—"}</td>
                <td className="py-2">
                  <button onClick={() => verDetalle(c)} className="text-sm text-terracota-700 hover:underline">
                    Ver
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-oliva-600">{t.admin.noClients}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSeleccionado(null)}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif text-2xl text-terracota-800">{seleccionado.nombre} {seleccionado.apellidos}</h2>
            <p className="text-oliva-700">{seleccionado.email}</p>
            {seleccionado.telefono && <p className="text-sm text-oliva-600">{seleccionado.telefono}</p>}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-terracota-50 p-3 text-center">
                <p className="text-xs text-oliva-700">Puntos totales</p>
                <p className="serif text-2xl font-semibold text-terracota-700">{seleccionado.puntos_total}</p>
              </div>
              <div className="rounded-lg bg-oliva-50 p-3 text-center">
                <p className="text-xs text-oliva-700">Puntos menú</p>
                <p className="serif text-2xl font-semibold text-oliva-700">{seleccionado.puntos_menu}</p>
              </div>
            </div>

            <h3 className="serif mt-6 text-lg text-terracota-800">Historial</h3>
            <ul className="mt-2 divide-y divide-crema-200">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p>{m.descripcion}</p>
                    <p className="text-xs text-oliva-600">{new Date(m.created_at).toLocaleString("es-ES")}</p>
                  </div>
                  <span className={`font-semibold ${m.puntos >= 0 ? "text-oliva-600" : "text-terracota-600"}`}>
                    {m.puntos >= 0 ? "+" : ""}{m.puntos}
                  </span>
                </li>
              ))}
              {movimientos.length === 0 && <li className="py-4 text-center text-oliva-600">Sin movimientos</li>}
            </ul>

            <button onClick={() => setSeleccionado(null)} className="btn-secondary mt-6 w-full">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
