"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface Invitacion {
  id: string;
  invitado_id: string;
  estado: "pendent" | "desbloquejada";
  created_at: string;
  desbloquejada_at: string | null;
  invitado?: { nombre: string | null; puntos_total: number } | null;
}

export default function InvitaPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const supa = createSupabaseBrowser();
    (async () => {
      const { data: auth } = await supa.auth.getUser();
      if (!auth.user) {
        router.replace("/login?redirect=/invita");
        return;
      }
      setUserId(auth.user.id);

      const { data: prof } = await supa
        .from("profiles")
        .select("codigo_invitacion")
        .eq("id", auth.user.id)
        .single();
      if (prof?.codigo_invitacion) setCodigo(prof.codigo_invitacion);

      // Invitacions enviades per aquest usuari
      const { data: invs } = await supa
        .from("invitaciones")
        .select("id, invitado_id, estado, created_at, desbloquejada_at")
        .eq("invitador_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (invs && invs.length > 0) {
        // Obtenir noms i punts dels invitats
        const ids = invs.map((i) => i.invitado_id);
        const { data: profs } = await supa
          .from("profiles")
          .select("id, nombre, puntos_total")
          .in("id", ids);
        const byId = new Map((profs || []).map((p) => [p.id, p]));
        const merged = invs.map((i) => ({
          ...i,
          invitado: byId.get(i.invitado_id)
            ? { nombre: byId.get(i.invitado_id)!.nombre, puntos_total: byId.get(i.invitado_id)!.puntos_total }
            : null,
        }));
        setInvitaciones(merged as Invitacion[]);
      }

      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (codigo && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/register?ref=${codigo}`);
    }
  }, [codigo]);

  const copiar = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  };

  const compartir = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.invita.shareTitle,
          text: t.invita.shareText,
          url: shareUrl,
        });
      } catch {
        /* cancel·lat */
      }
    } else {
      copiar();
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;
  }

  const desbloquejades = invitaciones.filter((i) => i.estado === "desbloquejada");
  const pendents = invitaciones.filter((i) => i.estado === "pendent");

  return (
    <div className="space-y-6 py-6">
      <div>
        <p className="text-sm text-oliva-600">
          <Link href="/dashboard" className="hover:underline">
            ← {t.nav.dashboard}
          </Link>
        </p>
        <h1 className="serif text-3xl text-terracota-800 md:text-4xl">
          👯 {t.invita.title}
        </h1>
        <p className="mt-1 text-oliva-700">{t.invita.subtitle}</p>
      </div>

      {/* Codi */}
      <div className="card bg-gradient-to-br from-terracota-50 to-crema-50">
        <p className="text-sm uppercase tracking-wider text-terracota-700">
          {t.invita.yourCode}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="serif text-4xl font-semibold tracking-widest text-terracota-800 md:text-5xl">
            {codigo || "—"}
          </span>
          <button
            onClick={copiar}
            className="rounded-full border border-terracota-300 px-4 py-2 text-sm text-terracota-800 hover:bg-terracota-100"
            disabled={!codigo}
          >
            {copiado ? "✓ " + t.invita.copied : t.invita.copyCode}
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-oliva-700">
          <p>{t.invita.ruleLine1}</p>
          <p>{t.invita.ruleLine2}</p>
          <p className="font-medium text-terracota-800">{t.invita.ruleLine3}</p>
        </div>
      </div>

      {/* Compartir enllaç */}
      {shareUrl && (
        <div className="card">
          <p className="text-sm font-medium text-oliva-800">{t.invita.shareLinkTitle}</p>
          <p className="mt-1 text-xs text-oliva-600 break-all">{shareUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={compartir} className="btn-primary">
              📤 {t.invita.shareButton}
            </button>
            <button onClick={copiar} className="btn-secondary">
              {copiado ? "✓ " + t.invita.copied : "📋 " + t.invita.copyLink}
            </button>
          </div>
        </div>
      )}

      {/* Resum */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-xs uppercase text-oliva-600">{t.invita.pending}</p>
          <p className="mt-1 text-3xl font-bold text-terracota-700">{pendents.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-oliva-600">{t.invita.unlocked}</p>
          <p className="mt-1 text-3xl font-bold text-oliva-700">{desbloquejades.length}</p>
        </div>
      </div>

      {/* Llista d'invitacions */}
      <div className="card">
        <h2 className="serif text-xl text-terracota-800">{t.invita.historyTitle}</h2>
        {invitaciones.length === 0 ? (
          <p className="mt-3 text-sm text-oliva-600">{t.invita.historyEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-crema-200">
            {invitaciones.map((inv) => {
              const nombre = inv.invitado?.nombre || t.invita.anonymous;
              const puntos = inv.invitado?.puntos_total ?? 0;
              return (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-oliva-800">{nombre}</p>
                    <p className="text-xs text-oliva-600">
                      {inv.estado === "desbloquejada"
                        ? tpl(t.invita.rowUnlocked, {
                            date: new Date(inv.desbloquejada_at || inv.created_at).toLocaleDateString(
                              lang === "ca" ? "ca-ES" : "es-ES"
                            ),
                          })
                        : tpl(t.invita.rowPending, { n: Math.max(0, 200 - puntos) })}
                    </p>
                  </div>
                  <span className="text-xl">
                    {inv.estado === "desbloquejada" ? "✅" : "⏳"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Nota anti-frau */}
      <p className="px-2 text-center text-xs text-oliva-600">
        {t.invita.fraudNote}
      </p>

      {/* Acabem amb userId per forçar el refresc si el codi ha canviat */}
      {userId && null}
    </div>
  );
}
