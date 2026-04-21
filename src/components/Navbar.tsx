"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { usePathname, useRouter } from "next/navigation";

const BOOK_URL =
  "https://www.covermanager.com/reservation/module_restaurant/restaurante-lapatdelprat/spanish";

export function Navbar() {
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? "" });
        const { data: profile } = await supa
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();
        setIsAdmin(profile?.is_admin === true);
      }
    });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supa = createSupabaseBrowser();
    await supa.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  // No mostramos navbar en rutas de impresión para no ocupar espacio
  if (pathname?.includes("/print")) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-crema-200 bg-crema-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terracota-600 text-crema-50 transition group-hover:scale-105">
            <span className="serif text-xl font-semibold leading-none">À</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="serif text-lg font-semibold text-terracota-800">L&apos;Àpat Fidel</span>
            <span className="text-xs text-oliva-700">{t.tagline}</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Selector idioma */}
          <div className="flex overflow-hidden rounded-full border border-oliva-300 text-xs font-medium">
            <button
              onClick={() => setLang("ca")}
              className={`px-2.5 py-1 transition ${lang === "ca" ? "bg-terracota-600 text-white" : "text-oliva-700 hover:bg-oliva-50"}`}
            >
              CA
            </button>
            <button
              onClick={() => setLang("es")}
              className={`px-2.5 py-1 transition ${lang === "es" ? "bg-terracota-600 text-white" : "text-oliva-700 hover:bg-oliva-50"}`}
            >
              ES
            </button>
          </div>

          {/* Desktop links */}
          <nav className="hidden items-center gap-1 md:flex">
            {user ? (
              <>
                <Link href="/dashboard" className="btn-ghost">{t.nav.dashboard}</Link>
                <Link href="/scan" className="btn-ghost">📷 {t.nav.scan}</Link>
                <Link href="/rewards" className="btn-ghost">{t.nav.rewards}</Link>
                <Link href="/mis-premios" className="btn-ghost">🎁 {t.nav.misPremios}</Link>
                <Link href="/roulette" className="btn-ghost">{t.nav.roulette}</Link>
                <Link href="/ressenya" className="btn-ghost">⭐ {t.nav.ressenya}</Link>
                <Link href="/historia" className="btn-ghost">📸 {t.nav.historia}</Link>
                <Link href="/invita" className="btn-ghost">👯 {t.nav.invita}</Link>
                <Link href="/news" className="btn-ghost">{t.nav.news}</Link>
                {isAdmin && (
                  <Link href="/admin" className="btn-ghost text-azulmar-700">{t.nav.admin}</Link>
                )}
                <button onClick={handleLogout} className="btn-ghost">{t.nav.logout}</button>
              </>
            ) : (
              <>
                <Link href="/news" className="btn-ghost">{t.nav.news}</Link>
                <Link href="/login" className="btn-ghost">{t.nav.login}</Link>
                <Link href="/register" className="btn-primary !py-2 !px-5">{t.nav.register}</Link>
              </>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-oliva-100 md:hidden"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
                  <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
                  <line x1="4" y1="17" x2="20" y2="17" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-crema-200 bg-crema-50 px-4 py-3 md:hidden">
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.dashboard}</Link>
              <Link href="/scan" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">📷 {t.nav.scan}</Link>
              <Link href="/rewards" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.rewards}</Link>
              <Link href="/mis-premios" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">🎁 {t.nav.misPremios}</Link>
              <Link href="/roulette" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.roulette}</Link>
              <Link href="/ressenya" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">⭐ {t.nav.ressenya}</Link>
              <Link href="/historia" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">📸 {t.nav.historia}</Link>
              <Link href="/invita" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">👯 {t.nav.invita}</Link>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-oliva-100"
              >
                🍽️ {t.nav.reservar}
              </a>
              <Link href="/news" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.news}</Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-azulmar-700 hover:bg-oliva-100">{t.nav.admin}</Link>
              )}
              <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left hover:bg-oliva-100">{t.nav.logout}</button>
            </>
          ) : (
            <>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-oliva-100"
              >
                🍽️ {t.nav.reservar}
              </a>
              <Link href="/news" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.news}</Link>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-oliva-100">{t.nav.login}</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary mt-2 w-full">{t.nav.register}</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
