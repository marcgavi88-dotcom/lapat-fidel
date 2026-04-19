import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "L'Àpat Fidel - Club de fidelitat de L'Àpat del Prat",
  description: "Acumula punts i aconsegueix premis a L'Àpat del Prat",
  manifest: "/manifest.json",
  applicationName: "L'Àpat Fidel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "L'Àpat Fidel",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#c95f33",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
