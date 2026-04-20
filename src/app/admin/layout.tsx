"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supa
        .from("profiles")
        .select("is_admin")
        .eq("id", auth.user.id)
        .single();
      if (!profile?.is_admin) {
        router.replace("/dashboard");
        return;
      }
      setOk(true);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  if (!ok) return null;

  const links = [
    { href: "/admin", label: t.admin.title, icon: "🏠" },
    { href: "/admin/qr", label: t.admin.generateQr, icon: "🎫" },
    { href: "/admin/clients", label: t.admin.clients, icon: "👥" },
    { href: "/admin/redemptions", label: t.admin.redemptions, icon: "🎁" },
    { href: "/admin/reviews", label: t.admin.reviews, icon: "⭐" },
    { href: "/admin/news", label: t.admin.news, icon: "📰" },
    { href: "/admin/newsletter", label: t.admin.newsletter, icon: "📧" },
    { href: "/admin/stats", label: t.admin.stats, icon: "📊" },
  ];

  return (
    <div className="py-4">
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-azulmar-600 text-white"
                    : "border border-oliva-200 bg-white text-oliva-800 hover:bg-oliva-50"
                }`}
              >
                {l.icon} {l.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
