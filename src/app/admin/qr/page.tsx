"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface QrGenerado {
  id: string;
  codigo: string;
  puntos: number;
  importe_euros: number;
  es_menu: boolean;
  expira_at: string;
  usado: boolean;
  created_at: string;
}

export default function AdminQrPage() {
  const { t } = useI18n();
  const [importe, setImporte] = useState("");
  const [esMenu, setEsMenu] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [ultimoQr, setUltimoQr] = useState<QrGenerado | null>(null);
  const [qrImage, setQrImage] = useState<string>("");
  const [historial, setHistorial] = useState<QrGenerado[]>([]);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    setSiteUrl(window.location.origin);
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    const supa = createSupabaseBrowser();
    const { data } = await supa
      .from("qr_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistorial(data);
  };

  const handleGenerar = async () => {
    if (!importe || Number(importe) <= 0) return;
    setGenerando(true);
    try {
      const res = await fetch("/api/admin/generate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importe: Number(importe), es_menu: esMenu }),
      });
      const json = await res.json();
      if (json.ok) {
        setUltimoQr(json.qr);
        const url = `${window.location.origin}/qr/${json.qr.codigo}`;
        const img = await QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: "M" });
        setQrImage(img);
        setImporte("");
        setEsMenu(false);
        cargarHistorial();
      } else {
        alert(json.error || t.common.error);
      }
    } catch {
      alert(t.common.error);
    } finally {
      setGenerando(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const puntosPreview = importe ? Math.round(Number(importe) * 2.5) : 0;
  const qrUrl = ultimoQr ? `${siteUrl}/qr/${ultimoQr.codigo}` : "";
  const siteHostname = siteUrl.replace(/^https?:\/\//, "");

  return (
    <div className="space-y-6">
      <h1 className="serif text-3xl text-terracota-800 no-print">{t.admin.generateQr}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <div className="card no-print">
          <h2 className="serif mb-4 text-xl text-terracota-800">Nuevo QR</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.admin.qrAmount}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                className="input-field"
                placeholder="23.50"
              />
              <p className="mt-1 text-sm text-oliva-600">
                = <strong>{puntosPreview} {t.dashboard.points}</strong> (2,5 × €)
              </p>
            </div>

            <label className="flex items-center gap-2 rounded-lg bg-crema-50 p-3 text-sm">
              <input type="checkbox" checked={esMenu} onChange={(e) => setEsMenu(e.target.checked)} />
              <span>{t.admin.qrIsMenu}</span>
            </label>

            <button onClick={handleGenerar} disabled={generando} className="btn-primary w-full">
              {generando ? t.common.loading : t.admin.qrGenerate}
            </button>
          </div>
        </div>

        {/* Preview del ticket (estilo impresora térmica) */}
        {ultimoQr && qrImage && (
          <div>
            <div className="mb-3 flex gap-2 no-print">
              <button onClick={handlePrint} className="btn-primary flex-1">
                🖨️ {t.admin.qrPrint}
              </button>
              <a href={qrImage} download={`qr-${ultimoQr.codigo}.png`} className="btn-secondary flex-1">
                ⬇️ {t.admin.qrDownload}
              </a>
            </div>

            <div id="ticket-print" className="ticket-preview">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14pt", fontWeight: "bold", marginBottom: "2mm" }}>
                  L&apos;ÀPAT DEL PRAT
                </div>
                <div style={{ fontSize: "9pt", marginBottom: "3mm" }}>
                  Arrossos i cuina mediterrània
                </div>
                <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

                <div style={{ margin: "3mm 0" }}>
                  <img src={qrImage} alt="QR" style={{ width: "50mm", height: "50mm", margin: "0 auto", display: "block" }} />
                </div>

                <div style={{ fontSize: "10pt", fontWeight: "bold", margin: "2mm 0" }}>
                  {t.admin.qrScanInstructions}
                </div>
                <div style={{ fontSize: "9pt", marginBottom: "2mm" }}>
                  Acumula punts i aconsegueix premis
                </div>

                <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

                <div style={{ fontSize: "14pt", fontWeight: "bold", margin: "2mm 0" }}>
                  {t.admin.qrValidFor} {ultimoQr.puntos} {t.dashboard.points.toUpperCase()}
                </div>
                <div style={{ fontSize: "9pt" }}>
                  Consumició: {ultimoQr.importe_euros.toFixed(2)}€
                </div>

                <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

                <div style={{ fontSize: "8pt", marginTop: "2mm" }}>
                  Si la càmera no funciona, entra a:
                </div>
                <div style={{ fontSize: "9pt", fontWeight: "bold", wordBreak: "break-all" }}>
                  {siteHostname}/qr/{ultimoQr.codigo}
                </div>

                <div style={{ fontSize: "8pt", marginTop: "3mm" }}>
                  Vàlid fins a: {new Date(ultimoQr.expira_at).toLocaleString("ca-ES")}
                </div>

                <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

                <div style={{ fontSize: "11pt", fontWeight: "bold", marginTop: "2mm" }}>
                  Gràcies! / ¡Gracias!
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="card no-print">
        <h2 className="serif mb-4 text-xl text-terracota-800">{t.admin.qrHistory}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-crema-200 text-left text-oliva-700">
                <th className="py-2">Fecha</th>
                <th className="py-2">Código</th>
                <th className="py-2">Importe</th>
                <th className="py-2">Puntos</th>
                <th className="py-2">Menú</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((q) => {
                const expirado = new Date(q.expira_at) < new Date();
                return (
                  <tr key={q.id} className="border-b border-crema-100">
                    <td className="py-2 text-xs text-oliva-600">
                      {new Date(q.created_at).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 font-mono">{q.codigo}</td>
                    <td className="py-2">{q.importe_euros.toFixed(2)}€</td>
                    <td className="py-2 font-semibold">{q.puntos}</td>
                    <td className="py-2">{q.es_menu ? "✓" : ""}</td>
                    <td className="py-2">
                      {q.usado ? (
                        <span className="text-oliva-600">✓ Usado</span>
                      ) : expirado ? (
                        <span className="text-red-600">Caducado</span>
                      ) : (
                        <span className="text-terracota-600">Pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
