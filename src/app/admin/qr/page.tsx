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
  croquetas: number;
  es_menu: boolean;
  expira_at: string;
  usado: boolean;
  created_at: string;
}

// 576 px = 72 mm @ 203 dpi → mida òptima per impressores tèrmiques de 80 mm
// (deixa marge de seguretat de ~4 mm a cada costat).
const TICKET_WIDTH = 576;

function drawDashedDivider(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
) {
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

async function buildTicketCanvas(opts: {
  qrUrl: string;
  puntos: number;
  importe: number;
  croquetas: number;
  expiraAt: string;
  hostname: string;
  codigo: string;
  pointsLabel: string;
  validForLabel: string;
}): Promise<HTMLCanvasElement> {
  const W = TICKET_WIDTH;
  const PAD = 28;

  // QR a part: pur b/n, alta correcció per resistir l'escalat tèrmic.
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, opts.qrUrl, {
    width: 440,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;

  // Mesurem dinàmicament l'alçada total abans de dibuixar.
  const sections: Array<{ h: number; draw: (cy: number) => void }> = [];
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";

  const addText = (
    text: string,
    font: string,
    lineH: number,
    gapAfter: number,
  ) => {
    sections.push({
      h: lineH + gapAfter,
      draw: (cy) => {
        ctx.font = font;
        ctx.fillText(text, W / 2, cy + lineH * 0.78);
      },
    });
  };
  const addDivider = (gapBefore: number, gapAfter: number) => {
    sections.push({
      h: gapBefore + 2 + gapAfter,
      draw: (cy) => drawDashedDivider(ctx, PAD, W - PAD, cy + gapBefore),
    });
  };
  const addImage = (img: HTMLCanvasElement, gapAfter: number) => {
    sections.push({
      h: img.height + gapAfter,
      draw: (cy) => ctx.drawImage(img, (W - img.width) / 2, cy),
    });
  };

  addText("L'ÀPAT DEL PRAT", "bold 38px Georgia, 'Times New Roman', serif", 40, 6);
  addText("Arrossos i cuina mediterrània", "20px sans-serif", 22, 12);
  addDivider(4, 14);
  addImage(qrCanvas, 14);
  addText("Escaneja amb la càmera", "bold 24px sans-serif", 26, 4);
  addText("Acumula punts i premis", "18px sans-serif", 20, 14);
  addDivider(4, 14);
  addText(
    `${opts.validForLabel.toUpperCase()} ${opts.puntos} ${opts.pointsLabel.toUpperCase()}`,
    "bold 36px sans-serif",
    38,
    6,
  );
  addText(
    `Consumició: ${opts.importe.toFixed(2)}€`,
    "20px sans-serif",
    22,
    14,
  );
  if (opts.croquetas > 0) {
    addDivider(0, 14);
    addText(
      `+${opts.croquetas} croquetes`,
      "bold 28px sans-serif",
      30,
      4,
    );
    addText(
      "Tirades a la Ruleta Croquetera",
      "18px sans-serif",
      20,
      14,
    );
  }
  addDivider(0, 14);
  addText("Si la càmera no funciona, entra a:", "16px sans-serif", 18, 4);
  addText(
    `${opts.hostname}/qr/${opts.codigo}`,
    "bold 20px 'Courier New', monospace",
    22,
    8,
  );
  addText(
    `Vàlid fins: ${new Date(opts.expiraAt).toLocaleString("ca-ES")}`,
    "16px sans-serif",
    18,
    14,
  );
  addDivider(0, 14);
  addText("Gràcies! / ¡Gracias!", "bold 28px sans-serif", 30, 0);

  const totalHeight =
    PAD + sections.reduce((acc, s) => acc + s.h, 0) + PAD;
  canvas.height = totalHeight;

  // Pintat real (refrescant context perquè algunes propietats es perden després de redimensionar).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, totalHeight);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";

  let cy = PAD;
  for (const s of sections) {
    s.draw(cy);
    cy += s.h;
  }

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export default function AdminQrPage() {
  const { t } = useI18n();
  const [importe, setImporte] = useState("");
  const [croquetas, setCroquetas] = useState("");
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
        body: JSON.stringify({
          importe: Number(importe),
          croquetas: Number(croquetas) || 0,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setUltimoQr(json.qr);
        const url = `${window.location.origin}/qr/${json.qr.codigo}`;
        const img = await QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: "M" });
        setQrImage(img);
        setImporte("");
        setCroquetas("");
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

  const buildTicketBlob = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!ultimoQr) return null;
    const canvas = await buildTicketCanvas({
      qrUrl,
      puntos: ultimoQr.puntos,
      importe: ultimoQr.importe_euros,
      croquetas: ultimoQr.croquetas,
      expiraAt: ultimoQr.expira_at,
      hostname: siteHostname,
      codigo: ultimoQr.codigo,
      pointsLabel: t.dashboard.points,
      validForLabel: t.admin.qrValidFor,
    });
    const blob = await canvasToBlob(canvas);
    return { blob, filename: `tiquet-${ultimoQr.codigo}.png` };
  };

  const handleDownloadTicket = async () => {
    const built = await buildTicketBlob();
    if (!built) return;
    const url = URL.createObjectURL(built.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = built.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareTicket = async () => {
    const built = await buildTicketBlob();
    if (!built) return;
    const file = new File([built.blob], built.filename, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: "Tiquet QR L'Àpat Fidel" });
        return;
      } catch (err) {
        // L'usuari ha cancel·lat o falla → fallback a descàrrega.
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    await handleDownloadTicket();
  };

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

            <div>
              <label className="mb-1 block text-sm font-medium">{t.admin.qrCroquetas}</label>
              <input
                type="number"
                step="1"
                min="0"
                value={croquetas}
                onChange={(e) => setCroquetas(e.target.value)}
                className="input-field"
                placeholder="8"
              />
              <p className="mt-1 text-sm text-oliva-600">
                🥟 Quantes croquetes ha consumit. Cada <strong>12</strong> atorga 1 tirada a la Ruleta Croquetera i cada <strong>100</strong>, 1 tirada PRO.
              </p>
            </div>

            <button onClick={handleGenerar} disabled={generando} className="btn-primary w-full">
              {generando ? t.common.loading : t.admin.qrGenerate}
            </button>
          </div>
        </div>

        {/* Preview del ticket (estilo impresora térmica) */}
        {ultimoQr && qrImage && (
          <div>
            <div className="mb-2 flex flex-col gap-2 no-print sm:flex-row">
              <button onClick={handleShareTicket} className="btn-primary flex-1">
                {t.admin.qrShareToPhotos}
              </button>
              <button onClick={handleDownloadTicket} className="btn-secondary flex-1">
                ⬇️ {t.admin.qrDownload}
              </button>
              <button onClick={handlePrint} className="btn-secondary flex-1">
                🖨️ {t.admin.qrPrint}
              </button>
            </div>
            <p className="mb-3 text-xs leading-snug text-oliva-600 no-print">
              {t.admin.qrPrintHelp}
            </p>

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

                {ultimoQr.croquetas > 0 && (
                  <>
                    <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />
                    <div style={{ fontSize: "11pt", fontWeight: "bold", margin: "1mm 0" }}>
                      🥟 +{ultimoQr.croquetas} croquetes
                    </div>
                    <div style={{ fontSize: "8pt" }}>
                      Tirades a la Ruleta Croquetera
                    </div>
                  </>
                )}

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
                <th className="py-2">🥟</th>
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
                    <td className="py-2">{q.croquetas ?? 0}</td>
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
