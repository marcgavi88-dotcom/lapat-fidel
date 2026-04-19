"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { t } = useI18n();
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-16 py-6 md:py-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-crema-200 bg-gradient-to-br from-crema-50 via-white to-terracota-50 p-8 md:p-14">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-terracota-100 opacity-60 blur-3xl" aria-hidden />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-oliva-100 opacity-60 blur-3xl" aria-hidden />

        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-terracota-200 bg-white px-3 py-1 text-sm text-terracota-700">
            <span className="h-2 w-2 rounded-full bg-terracota-500" />
            L&apos;Àpat del Prat
          </span>
          <h1 className="mt-5 text-4xl leading-tight text-terracota-900 md:text-6xl">
            {t.home.heroTitle}
          </h1>
          <p className="mt-4 text-lg text-oliva-800 md:text-xl">
            {t.home.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary text-base">
              {t.home.ctaRegister}
            </Link>
            <Link href="/login" className="btn-secondary text-base">
              {t.home.ctaLogin}
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section>
        <h2 className="serif mb-8 text-center text-3xl text-terracota-800 md:text-4xl">
          {t.home.howItWorks}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { n: "1", title: t.home.step1Title, desc: t.home.step1Desc, icon: "👤" },
            { n: "2", title: t.home.step2Title, desc: t.home.step2Desc, icon: "📱" },
            { n: "3", title: t.home.step3Title, desc: t.home.step3Desc, icon: "🎁" },
          ].map((s) => (
            <div key={s.n} className="card flex flex-col items-start gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-terracota-600 serif font-semibold text-white">
                  {s.n}
                </span>
                <span className="text-3xl">{s.icon}</span>
              </div>
              <h3 className="serif text-xl text-terracota-800">{s.title}</h3>
              <p className="text-oliva-700">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recompensas preview */}
      <section className="card bg-oliva-50/60">
        <h2 className="serif mb-6 text-2xl text-terracota-800 md:text-3xl">
          {t.nav.rewards}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { n: "Café / Cafè", p: 125 },
            { n: "Postre", p: 200 },
            { n: "Menú mediodía", p: 500 },
            { n: "Arroz 2 pax", p: 1000 },
            { n: "Cena 2 pax", p: 2000 },
            { n: "Cuchillo profesional", p: 2500 },
          ].map((r) => (
            <div key={r.n} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
              <span className="font-medium">{r.n}</span>
              <span className="text-sm text-terracota-700">{r.p} pts</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
