"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";

export default function BenvingudaPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-xl py-6 md:py-10">
      {/* Hero */}
      <div className="card overflow-hidden p-6 text-center md:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-terracota-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-terracota-800">
          <span>🎁</span>
          <span>{t.welcome.badge}</span>
        </div>

        <div className="mb-4 text-6xl md:text-7xl" aria-hidden>
          ☕
        </div>

        <h1 className="serif mb-3 text-3xl text-terracota-800 md:text-4xl">
          {t.welcome.title}
        </h1>
        <p className="mx-auto max-w-md text-oliva-700">{t.welcome.subtitle}</p>

        <Link
          href="/register?promo=cafe"
          className="btn-primary mt-6 inline-block w-full text-center md:w-auto md:px-8"
        >
          {t.welcome.cta}
        </Link>

        <p className="mt-4 text-xs text-oliva-600">
          {t.welcome.haveAccount}{" "}
          <Link
            href="/login"
            className="font-medium text-terracota-700 hover:underline"
          >
            {t.nav.login}
          </Link>
          <span className="ml-1 text-oliva-500">
            · {t.welcome.haveAccountNote}
          </span>
        </p>
      </div>

      {/* What's included */}
      <div className="card mt-6 p-6">
        <h2 className="serif mb-4 text-xl text-terracota-800">
          {t.welcome.perksTitle}
        </h2>
        <ul className="space-y-2 text-sm text-oliva-800">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-terracota-600">✓</span>
            <span>{t.welcome.perk1}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-terracota-600">✓</span>
            <span>{t.welcome.perk2}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-terracota-600">✓</span>
            <span>{t.welcome.perk3}</span>
          </li>
        </ul>
      </div>

      {/* Steps */}
      <div className="card mt-6 p-6">
        <h2 className="serif mb-4 text-xl text-terracota-800">
          {t.welcome.howTitle}
        </h2>
        <ol className="space-y-3 text-sm text-oliva-800">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 font-semibold text-terracota-800">
              1
            </span>
            <span>{t.welcome.how1}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 font-semibold text-terracota-800">
              2
            </span>
            <span>{t.welcome.how2}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracota-100 font-semibold text-terracota-800">
              3
            </span>
            <span>{t.welcome.how3}</span>
          </li>
        </ol>
      </div>

      <p className="mt-6 text-center text-xs text-oliva-500">
        {t.welcome.legal}
      </p>
    </div>
  );
}
