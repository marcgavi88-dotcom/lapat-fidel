"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

const RESTRICTED_FOR_LIMITED = new Set<string>([
  "/admin/clients",
  "/admin/news",
  "/admin/newsletter",
]);

export default function AdminHome() {
  const { t } = useI18n();
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supa
        .from("profiles")
        .select("is_admin_limitado")
        .eq("id", auth.user.id)
        .single();
      setLimited(!!profile?.is_admin_limitado);
    })();
  }, []);

  const allCards = [
    { href: "/admin/qr", label: t.admin.generateQr, icon: "🎫", desc: "Crear códigos QR para premiar consumos" },
    { href: "/admin/clients", label: t.admin.clients, icon: "👥", desc: "Gestionar la base de clientes" },
    { href: "/admin/redemptions", label: t.admin.redemptions, icon: "🎁", desc: "Validar canjes de premios" },
    { href: "/admin/news", label: t.admin.news, icon: "📰", desc: "Publicar noticias y promociones" },
    { href: "/admin/newsletter", label: t.admin.newsletter, icon: "📧", desc: "Enviar emails masivos a clientes" },
    { href: "/admin/stats", label: t.admin.stats, icon: "📊", desc: "Ver estadísticas del programa" },
  ];
  const cards = limited
    ? allCards.filter((c) => !RESTRICTED_FOR_LIMITED.has(c.href))
    : allCards;

  return (
    <div>
      <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.admin.title}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card transition hover:shadow-md">
            <div className="text-3xl">{c.icon}</div>
            <h2 className="serif mt-2 text-xl text-terracota-800">{c.label}</h2>
            <p className="mt-1 text-sm text-oliva-700">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
