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

interface Impact {
  user_id: string;
  n_moviments: number;
  n_canjes: number;
  n_stories: number;
  n_reviews: number;
  n_invitaciones: number;
}

export default function AdminClientsPage() {
  const { t } = useI18n();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  // Modal d'ajust de punts
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustMotivo, setAdjustMotivo] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Modal d'esborrat
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  const [toast, setToast] = useState<string | null>(null);

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
    // Carrega l'impacte per si s'obre el modal d'esborrat
    const { data: imp } = await supa
      .from("v_admin_user_impact")
      .select("*")
      .eq("user_id", c.id)
      .single();
    if (imp) setImpact(imp as Impact);
  };

  const tancarDetalle = () => {
    setSeleccionado(null);
    setMovimientos([]);
    setImpact(null);
    setAdjustOpen(false);
    setDeleteOpen(false);
  };

  const obrirAjust = () => {
    setAdjustDelta("");
    setAdjustMotivo("");
    setAdjustError(null);
    setAdjustOpen(true);
  };

  const aplicarAjust = async () => {
    if (!seleccionado) return;
    setAdjustError(null);
    const delta = Math.trunc(Number(adjustDelta));
    if (!Number.isFinite(delta) || delta === 0) {
      setAdjustError(t.admin.adjustErrorDelta);
      return;
    }
    if (adjustMotivo.trim().length < 3) {
      setAdjustError(t.admin.adjustErrorShort);
      return;
    }
    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/adjust-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: seleccionado.id,
          delta,
          motivo: adjustMotivo.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.error === "saldo_insuficient") {
          setAdjustError(t.admin.adjustErrorBalance);
        } else if (json.error === "motiu_massa_curt") {
          setAdjustError(t.admin.adjustErrorShort);
        } else if (json.error === "delta_invalid") {
          setAdjustError(t.admin.adjustErrorDelta);
        } else {
          setAdjustError(t.admin.adjustErrorGeneric);
        }
        return;
      }
      // Actualitza local
      const nouSaldo = json.saldo_nou as number;
      setClientes((prev) =>
        prev.map((c) =>
          c.id === seleccionado.id ? { ...c, puntos_total: nouSaldo } : c
        )
      );
      setSeleccionado({ ...seleccionado, puntos_total: nouSaldo });
      setToast(t.admin.adjustSuccess);
      setTimeout(() => setToast(null), 3000);
      // Refresca moviments
      verDetalle({ ...seleccionado, puntos_total: nouSaldo });
      setAdjustOpen(false);
    } catch {
      setAdjustError(t.admin.adjustErrorGeneric);
    } finally {
      setAdjustLoading(false);
    }
  };

  const obrirDelete = () => {
    setDeleteConfirmText("");
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const confirmarDelete = async () => {
    if (!seleccionado) return;
    setDeleteError(null);
    const expected =
      t.admin.deleteConfirmPlaceholder?.toString?.() ?? "ELIMINAR";
    if (deleteConfirmText.trim().toUpperCase() !== expected.toUpperCase()) {
      setDeleteError(t.admin.deleteErrorGeneric);
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: seleccionado.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.error === "no_autoesborrat") {
          setDeleteError(t.admin.deleteErrorSelf);
        } else {
          setDeleteError(t.admin.deleteErrorGeneric);
        }
        return;
      }
      // Treu de la llista
      setClientes((prev) => prev.filter((c) => c.id !== seleccionado.id));
      setToast(t.admin.deleteSuccess);
      setTimeout(() => setToast(null), 3000);
      tancarDetalle();
    } catch {
      setDeleteError(t.admin.deleteErrorGeneric);
    } finally {
      setDeleteLoading(false);
    }
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={tancarDetalle}>
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

            {/* Accions admin */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={obrirAjust} className="btn-secondary text-sm">
                ➕➖ {t.admin.actionAdjustPoints}
              </button>
              <button
                onClick={obrirDelete}
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                🗑️ {t.admin.actionDeleteUser}
              </button>
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

            <button onClick={tancarDetalle} className="btn-secondary mt-6 w-full">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal ajust de punts */}
      {adjustOpen && seleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !adjustLoading && setAdjustOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl text-terracota-800">{t.admin.adjustTitle}</h3>
            <p className="mt-1 text-sm text-oliva-700">
              {seleccionado.nombre} {seleccionado.apellidos} — <span className="font-semibold text-terracota-700">{seleccionado.puntos_total} pts</span>
            </p>

            <label className="mt-4 block text-sm font-medium text-oliva-800">
              {t.admin.adjustDeltaLabel}
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              className="input-field mt-1"
              placeholder="+25  ·  -10"
              disabled={adjustLoading}
            />
            <p className="mt-1 text-xs text-oliva-600">{t.admin.adjustDeltaHint}</p>

            <label className="mt-3 block text-sm font-medium text-oliva-800">
              {t.admin.adjustMotivoLabel}
            </label>
            <textarea
              value={adjustMotivo}
              onChange={(e) => setAdjustMotivo(e.target.value)}
              className="input-field mt-1 min-h-[80px]"
              placeholder={t.admin.adjustMotivoPlaceholder}
              disabled={adjustLoading}
            />

            {adjustError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{adjustError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAdjustOpen(false)}
                disabled={adjustLoading}
                className="btn-secondary"
              >
                {t.admin.adjustCancel}
              </button>
              <button
                onClick={aplicarAjust}
                disabled={adjustLoading}
                className="btn-primary"
              >
                {adjustLoading ? "…" : t.admin.adjustConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal esborrat */}
      {deleteOpen && seleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteLoading && setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl text-red-700">{t.admin.deleteTitle}</h3>
            <p className="mt-1 text-sm text-oliva-700">
              {seleccionado.nombre} {seleccionado.apellidos} · {seleccionado.email}
            </p>

            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              ⚠️ {t.admin.deleteWarn}
            </div>

            {impact && (
              <div className="mt-3 rounded-lg border border-crema-200 p-3">
                <p className="text-sm font-medium text-oliva-800">{t.admin.deleteImpactTitle}</p>
                <ul className="mt-2 space-y-1 text-sm text-oliva-700">
                  <li>• {impact.n_moviments} {t.admin.deleteImpactMoviments}</li>
                  <li>• {impact.n_canjes} {t.admin.deleteImpactCanjes}</li>
                  <li>• {impact.n_stories} {t.admin.deleteImpactStories}</li>
                  <li>• {impact.n_reviews} {t.admin.deleteImpactReviews}</li>
                  <li>• {impact.n_invitaciones} {t.admin.deleteImpactInvites}</li>
                </ul>
              </div>
            )}

            <label className="mt-4 block text-sm font-medium text-oliva-800">
              {t.admin.deleteConfirmLabel}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input-field mt-1"
              placeholder={t.admin.deleteConfirmPlaceholder}
              disabled={deleteLoading}
            />

            {deleteError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleteLoading}
                className="btn-secondary"
              >
                {t.admin.deleteCancel}
              </button>
              <button
                onClick={confirmarDelete}
                disabled={
                  deleteLoading ||
                  deleteConfirmText.trim().toUpperCase() !==
                    (t.admin.deleteConfirmPlaceholder?.toString?.() ?? "ELIMINAR").toUpperCase()
                }
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "…" : t.admin.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-oliva-800 px-5 py-2 text-sm text-white shadow-lg">
          ✅ {toast}
        </div>
      )}
    </div>
  );
}
