import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "L'Àpat Fidel - Club de fidelitat de L'Àpat del Prat",
  description: "Acumula punts i aconsegueix premis a L'Àpat del Prat",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "L'Àpat Fidel",
  },
};

export const viewport: Viewport = {
  themeColor: "#c95f33",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body className="mediterranean-pattern min-h-screen">
        <I18nProvider>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 pb-20 pt-4 md:pt-8">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
