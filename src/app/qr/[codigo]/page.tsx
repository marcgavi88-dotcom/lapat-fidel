"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";

interface QrInfo {
  codigo: string;
  puntos: number;
  importe_euros: number;
  es_menu: boolean;
  usado: boolean;
  expira_at: string;
}

export default function QrLanding() {
  const params = useParams<{ codigo: string }>();
  const codigo = params?.codigo ?? "";
  const router = useRouter();
  const { t, lang } = useI18n();

  const [qrInfo, setQrInfo] = useState<QrInfo | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ puntos: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      // 1. Consultar información del QR (endpoint público)
      try {
        const res = await fetch(`/api/qr/info?codigo=${encodeURIComponent(codigo)}`);
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "qr_no_encontrado");
          setLoading(false);
          return;
        }
        setQrInfo(json.qr);

        // 2. Comprobar si el usuario está logado
        const supa = createSupabaseBrowser();
        const { data } = await supa.auth.getUser();
        if (data.user) setUser({ id: data.user.id, email: data.user.email ?? "" });
      } catch (e) {
        setError("network_error");
      } finally {
        setLoading(false);
      }
    })();
  }, [codigo]);

  const handleClaim = async () => {
    if (!user || !qrInfo) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/qr/reclamar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "error");
      } else {
        setSuccess({ puntos: json.puntos_ganados, total: json.puntos_total });
      }
    } catch {
      setError("network_error");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">{t.common.loading}</div>;
  }

  // Estado: éxito al reclamar
  if (success) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="card text-center">
          <div className="mb-4 text-6xl">🎉</div>
          <h1 className="serif text-3xl text-terracota-800">
            {tpl(t.qr.success, { points: success.puntos, total: success.total })}
          </h1>
          <div className="my-6 text-5xl font-semibold text-terracota-600">
            +{success.puntos} <span className="text-2xl font-normal text-oliva-700">{t.dashboard.points}</span>
          </div>
          <Link href="/dashboard" className="btn-primary">
            {t.nav.dashboard}
          </Link>
        </div>
      </div>
    );
  }

  // Estado: error
  if (error || !qrInfo) {
    let mensaje = t.qr.errorNotFound;
    if (error === "qr_ya_usado") mensaje = t.qr.errorUsed;
    else if (error === "qr_caducado") mensaje = t.qr.errorExpired;
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="card text-center">
          <div className="mb-4 text-6xl">😔</div>
          <h1 className="serif text-2xl text-terracota-800">{mensaje}</h1>
          <Link href="/" className="btn-secondary mt-6">
            {t.common.back}
          </Link>
        </div>
      </div>
    );
  }

  const siguientePremio = getSiguientePremio(qrInfo.puntos, lang);

  return (
    <div className="mx-auto max-w-md py-6">
      {/* Header del restaurante */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-terracota-600 text-white">
          <span className="serif text-2xl font-semibold">À</span>
        </div>
        <h1 className="serif text-2xl text-terracota-800">L&apos;Àpat del Prat</h1>
        <p className="text-sm text-oliva-700">{t.tagline}</p>
      </div>

      {/* Caja principal con puntos */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terracota-600 to-terracota-800 p-8 text-center text-white shadow-lg">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-wider text-crema-100">🎁 {t.qr.title}</p>
          <div className="mt-3 serif text-7xl font-semibold">+{qrInfo.puntos}</div>
          <p className="mt-1 text-lg text-crema-100">{t.dashboard.points}</p>
          {siguientePremio && (
            <p className="mt-4 text-sm text-crema-100">
              {tpl(t.qr.closeToReward, { reward: siguientePremio.nombre })}
            </p>
          )}
        </div>
      </div>

      {/* Botones según si está logado */}
      <div className="mt-6 space-y-3">
        {user ? (
          <button onClick={handleClaim} disabled={claiming} className="btn-primary w-full text-lg">
            {claiming ? t.common.loading : tpl(t.qr.claim, { points: qrInfo.puntos })}
          </button>
        ) : (
          <>
            <p className="text-center text-sm text-oliva-700">{t.qr.subtitleGuest}</p>
            <Link href={`/register?qr=${codigo}`} className="btn-primary w-full text-lg">
              {t.qr.claimAndRegister}
            </Link>
            <Link href={`/login?qr=${codigo}`} className="btn-secondary w-full">
              {t.qr.alreadyAccount}
            </Link>
          </>
        )}
      </div>

      {/* Pasos visuales */}
      <div className="mt-8 rounded-2xl border border-crema-200 bg-white p-5">
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-terracota-100 text-terracota-700">1</div>
            <p className="font-medium">{t.home.step1Title}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-terracota-100 text-terracota-700">2</div>
            <p className="font-medium">{t.home.step2Title}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-terracota-100 text-terracota-700">3</div>
            <p className="font-medium">{t.home.step3Title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSiguientePremio(puntosNuevos: number, lang: string) {
  const premios = [
    { p: 125, ca: "Cafè gratis", es: "Café gratis" },
    { p: 200, ca: "Postres gratis", es: "Postre gratis" },
    { p: 500, ca: "Menú gratis", es: "Menú gratis" },
  ];
  for (const pr of premios) {
    if (puntosNuevos <= pr.p) {
      return { nombre: lang === "ca" ? pr.ca : pr.es };
    }
  }
  return null;
}
