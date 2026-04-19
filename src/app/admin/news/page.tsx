"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Noticia {
  id: string;
  titulo_ca: string;
  titulo_es: string;
  contenido_ca: string;
  contenido_es: string;
  imagen_url: string | null;
  publicada: boolean;
  created_at: string;
}

export default function AdminNewsPage() {
  const { t } = useI18n();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [editando, setEditando] = useState<Partial<Noticia> | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    const supa = createSupabaseBrowser();
    const { data } = await supa.from("noticias").select("*").order("created_at", { ascending: false });
    if (data) setNoticias(data);
  };

  const guardar = async () => {
    if (!editando?.titulo_ca || !editando?.titulo_es || !editando?.contenido_ca || !editando?.contenido_es) {
      alert("Completa todos los campos en catalán y castellano");
      return;
    }
    const supa = createSupabaseBrowser();
    const { data: auth } = await supa.auth.getUser();
    const payload = {
      titulo_ca: editando.titulo_ca,
      titulo_es: editando.titulo_es,
      contenido_ca: editando.contenido_ca,
      contenido_es: editando.contenido_es,
      imagen_url: editando.imagen_url || null,
      publicada: editando.publicada ?? true,
    };
    if (editando.id) {
      await supa.from("noticias").update(payload).eq("id", editando.id);
    } else {
      await supa.from("noticias").insert({ ...payload, created_by: auth.user?.id });
    }
    setEditando(null);
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta noticia?")) return;
    const supa = createSupabaseBrowser();
    await supa.from("noticias").delete().eq("id", id);
    cargar();
  };

  const togglePub = async (n: Noticia) => {
    const supa = createSupabaseBrowser();
    await supa.from("noticias").update({ publicada: !n.publicada }).eq("id", n.id);
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="serif text-3xl text-terracota-800">{t.admin.news}</h1>
        <button onClick={() => setEditando({})} className="btn-primary">
          + Nueva noticia
        </button>
      </div>

      <div className="space-y-3">
        {noticias.map((n) => (
          <div key={n.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="serif text-lg text-terracota-800">{n.titulo_es}</h3>
              <p className="mt-1 text-xs text-oliva-600">{new Date(n.created_at).toLocaleDateString("es-ES")}</p>
              <p className="mt-2 line-clamp-2 text-sm text-oliva-700">{n.contenido_es}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => togglePub(n)} className={`rounded px-3 py-1 text-xs ${n.publicada ? "bg-oliva-100 text-oliva-800" : "bg-red-100 text-red-700"}`}>
                {n.publicada ? "Publicada" : "Oculta"}
              </button>
              <button onClick={() => setEditando(n)} className="rounded bg-terracota-100 px-3 py-1 text-xs text-terracota-800">Editar</button>
              <button onClick={() => eliminar(n.id)} className="rounded bg-red-100 px-3 py-1 text-xs text-red-700">Eliminar</button>
            </div>
          </div>
        ))}
        {noticias.length === 0 && <p className="text-center text-oliva-600">Aún no hay noticias</p>}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditando(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif mb-4 text-2xl text-terracota-800">
              {editando.id ? "Editar noticia" : "Nueva noticia"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Título (Català)</label>
                <input value={editando.titulo_ca || ""} onChange={(e) => setEditando({ ...editando, titulo_ca: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Título (Castellano)</label>
                <input value={editando.titulo_es || ""} onChange={(e) => setEditando({ ...editando, titulo_es: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Contenido (Català)</label>
                <textarea rows={5} value={editando.contenido_ca || ""} onChange={(e) => setEditando({ ...editando, contenido_ca: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Contenido (Castellano)</label>
                <textarea rows={5} value={editando.contenido_es || ""} onChange={(e) => setEditando({ ...editando, contenido_es: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">URL imagen (opcional)</label>
                <input value={editando.imagen_url || ""} onChange={(e) => setEditando({ ...editando, imagen_url: e.target.value })} className="input-field" placeholder="https://..." />
              </div>
              <div className="flex gap-2 pt-3">
                <button onClick={() => setEditando(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardar} className="btn-primary flex-1">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
