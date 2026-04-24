// Minimal ePOS-Print SOAP client for Epson TM printers.
//
// The TM-m30III exposes a SOAP endpoint at
//   https://<ip>/cgi-bin/epos/service.cgi?devid=local_printer&timeout=<ms>
// that accepts an <epos-print> XML payload and prints directly.
//
// To avoid mixed-content blocking (this app is served from HTTPS) we call
// the printer over HTTPS as well. The printer uses a self-signed cert, so
// the browser must have accepted it once. On an iPad that is done by
// visiting https://<ip>/ once and tapping "Visit this website" / "Advanced".
//
// References:
//   https://download4.epson.biz/sec_pubs/pos/reference_en/epos_print/
//   https://files.support.epson.com/pdf/pos/bulk/epos-print_xml_um_en_revk.pdf

const NS = 'xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"';

export interface EposTicketData {
  qrDataUrl: string; // "data:image/png;base64,..."
  titleLine: string;
  subtitleLine: string;
  pointsLine: string; // e.g. "VAL PER 50 PUNTS"
  amountLine: string; // e.g. "Consumicio: 20.00 EUR"
  croquetasLine?: string; // e.g. "+5 croquetes"
  fallbackUrlLine: string;
  validUntilLine: string;
  footerLine: string;
}

const escXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * Convert a PNG data URL into a 1-bit raster payload suitable for ePOS-Print
 * <image> element. Returns an object with width, height and base64 raster.
 * The raster uses Epson's packed monochrome format where 1 byte = 8 pixels,
 * MSB first, and each row is padded to a full byte.
 */
async function dataUrlToEposRaster(
  dataUrl: string,
  targetWidth: number,
): Promise<{ width: number; height: number; rasterB64: string }> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const ratio = targetWidth / img.width;
  const W = Math.floor(targetWidth / 8) * 8; // must be multiple of 8
  const H = Math.round(img.height * (W / img.width));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  // Pack into 1-bit per pixel (0 = white, 1 = black).
  const bytesPerRow = W / 8;
  const packed = new Uint8Array(bytesPerRow * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      // Composite on white, then threshold.
      const alpha = a / 255;
      const R = r * alpha + 255 * (1 - alpha);
      const G = g * alpha + 255 * (1 - alpha);
      const B = b * alpha + 255 * (1 - alpha);
      const lum = 0.299 * R + 0.587 * G + 0.114 * B;
      if (lum < 128) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        packed[byteIndex] |= 0x80 >> (x & 7);
      }
    }
  }

  // Base64-encode.
  let bin = "";
  for (let i = 0; i < packed.length; i++) bin += String.fromCharCode(packed[i]);
  return {
    width: W,
    height: H,
    rasterB64: btoa(bin),
  };
}

export async function buildEposXml(t: EposTicketData): Promise<string> {
  // QR target width in dots. 80 mm printhead = 576 dots total.
  const qr = await dataUrlToEposRaster(t.qrDataUrl, 400);

  const croq = t.croquetasLine
    ? [
        '      <text align="center" em="true" dw="true" dh="true">' +
          escXml(t.croquetasLine) +
          "&#10;</text>",
        '      <text align="center">Tirades a la Ruleta Croquetera&#10;</text>',
        "      <feed/>",
      ].join("\n")
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print ${NS}>
      <text align="center" em="true" dw="true" dh="true">${escXml(t.titleLine)}&#10;</text>
      <text align="center">${escXml(t.subtitleLine)}&#10;</text>
      <feed/>
      <text align="center">--------------------------------&#10;</text>
      <image width="${qr.width}" height="${qr.height}" align="center" color="color_1" mode="mono">${qr.rasterB64}</image>
      <text align="center" em="true">Escaneja amb la camera&#10;</text>
      <text align="center">Acumula punts i premis&#10;</text>
      <feed/>
      <text align="center">--------------------------------&#10;</text>
      <text align="center" em="true" dw="true" dh="true">${escXml(t.pointsLine)}&#10;</text>
      <text align="center">${escXml(t.amountLine)}&#10;</text>
${croq}
      <text align="center">--------------------------------&#10;</text>
      <text align="center">Si la camera no funciona:&#10;</text>
      <text align="center" em="true">${escXml(t.fallbackUrlLine)}&#10;</text>
      <feed/>
      <text align="center">${escXml(t.validUntilLine)}&#10;</text>
      <text align="center">--------------------------------&#10;</text>
      <text align="center" em="true" dw="true">${escXml(t.footerLine)}&#10;</text>
      <feed line="3"/>
      <cut type="feed"/>
    </epos-print>
  </s:Body>
</s:Envelope>`;
}

export interface PrintResult {
  success: boolean;
  code?: string;
  status?: number;
  message?: string;
}

export async function sendToEpsonPrinter(
  printerIp: string,
  xml: string,
  opts: {
    useHttps?: boolean;
    devId?: string;
    timeoutMs?: number;
  } = {},
): Promise<PrintResult> {
  const scheme = opts.useHttps === false ? "http" : "https";
  const devId = opts.devId ?? "local_printer";
  const timeout = opts.timeoutMs ?? 10000;
  const url = `${scheme}://${printerIp}/cgi-bin/epos/service.cgi?devid=${devId}&timeout=${timeout}`;

  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeout + 2000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
        "If-Modified-Since": new Date().toUTCString(),
      },
      body: xml,
      signal: ctl.signal,
      // Keep default CORS mode; TM printers send Access-Control-Allow-Origin: *.
    });

    const text = await res.text();
    const success = /success="true"/.test(text);
    const codeMatch = text.match(/code="([^"]+)"/);
    return {
      success,
      code: codeMatch?.[1],
      status: res.status,
      message: text,
    };
  } catch (err) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(to);
  }
}
