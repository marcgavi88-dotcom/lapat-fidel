"use client";

import dynamic from "next/dynamic";

// Carreguem el client de forma dinàmica i sense SSR perquè html5-qrcode
// accedeix a navigator.mediaDevices, que no existeix al servidor.
const QrScannerClient = dynamic(() => import("./QrScannerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">
      Carregant escàner...
    </div>
  ),
});

export default function ScanPage() {
  return <QrScannerClient />;
}
