"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Newsletter {
  id: string;
  asunto: string;
  destinatarios: number;
  enviada_at: string;
}

export default function AdminNewsletterPage() {
  const { t } = useI18n();
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [suscritos, setSuscritos] = useState(0);
  const [historial, setHistorial] = useState<Newsletter[]>([]);

  useEffect(() => {
    (async () => {
      const supa = createSupabaseBrowser();
      const { count } = await supa
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("acepta_promociones", true);
      setSuscritos(count || 0);

      const { data } = await supa
        .from("newsletters")
        .select("id, asunto, destinatarios, enviada_at")
        .order("enviada_at", { ascending: false })
        .limit(10);
      if (data) setHistorial(data);
    })();
  }, []);

  const enviar = async () => {
    if (!asunto || !contenido) return;
    if (!confirm(`¿Enviar newsletter a ${suscritos} clientes?`)) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asunto, contenido_html: contenido }),
      });
      const json = await res.json();
      if (json.ok) {
        setResultado(`✓ Enviados: ${json.enviados}${json.fallados > 0 ? ` (${json.fallados} fallidos)` : ""}`);
        setAsunto("");
        setContenido("");
      } else {
        setResultado(`❌ Error: ${json.error}`);
      }
    } catch {
      setResultado("❌ Error de red");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="serif text-3xl text-terracota-800">{t.admin.newsletter}</h1>
        <p className="mt-1 text-oliva-700">
          Suscritos actuales: <strong>{suscritos}</strong>
        </p>
      </div>

      <div className="card">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Asunto</label>
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="input-field" placeholder="Nueva promoción en L'Àpat del Prat" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contenido (HTML)</label>
            <textarea
              rows={10}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              className="input-field font-mono text-sm"
              placeholder={`<h1>Hola {{nombre}}!</h1>
<p>Aquest cap de setmana tenim una oferta especial...</p>`}
            />
            <p className="mt-1 text-xs text-oliva-600">
              Puedes usar <code className="rounded bg-crema-100 px-1">&#123;&#123;nombre&#125;&#125;</code> para personalizar con el nombre del cliente.
            </p>
          </div>

          <button onClick={enviar} disabled={enviando || !asunto || !contenido} className="btn-primary w-full">
            {enviando ? "Enviando..." : `Enviar a ${suscritos} clientes`}
          </button>

          {resultado && (
            <div className="rounded-lg bg-oliva-50 px-4 py-3 text-sm">{resultado}</div>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="card">
        <h2 className="serif mb-4 text-xl text-terracota-800">Historial de envíos</h2>
        <ul className="divide-y divide-crema-200">
          {historial.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{h.asunto}</p>
                <p className="text-xs text-oliva-600">{new Date(h.enviada_at).toLocaleString("es-ES")}</p>
              </div>
              <span className="text-oliva-700">{h.destinatarios} envíos</span>
            </li>
          ))}
          {historial.length === 0 && <li className="py-4 text-center text-oliva-600">Sin envíos aún</li>}
        </ul>
      </div>
    </div>
  );
}
