"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n, tpl } from "@/i18n/provider";
import InstallPWA from "@/components/InstallPWA";

interface PromoInfo {
  codigo: string;
  expira_at: string;
  descripcion_ca: string | null;
  descripcion_es: string | null;
}

interface PremioInfo {
  nombre_ca: string;
  nombre_es: string;
  descripcion_ca: string | null;
  descripcion_es: string | null;
}

export default function PromoLanding() {
  const params = useParams<{ codigo: string }>();
  const codigo = params?.codigo ?? "";
  const { t, lang } = useI18n();

  const [promo, setPromo] = useState<PromoInfo | null>(null);
  const [premio, setPremio] = useState<PremioInfo | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ codigo_canje: string } | null>(null);

  // Guard per evitar que l'auto-claim s'executi més d'una vegada
  // (per exemple, si React re-renderitza o l'efecte es torna a disparar).
  const autoClaimAttempted = useRef(false);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/promo/reclamar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "error");
      } else {
        setSuccess({ codigo_canje: json.codigo_canje });
      }
    } catch {
      setError("network_error");
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/promo/info?codigo=${encodeURIComponent(codigo)}`,
        );
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "promo_no_existe");
          return;
        }
        setPromo(json.promo);
        setPremio(json.premio);

        const supa = createSupabaseBrowser();
        const { data } = await supa.auth.getUser();
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email ?? "" });

          // Auto-claim: si l'usuari ja està logat (vé del registre o ja
          // tenia sessió), reclamem el premi automàticament. La RPC és
          // idempotent, així que si ja l'havia reclamat retorna el codi
          // existent — mai genera duplicats. Mantenim loading=true durant
          // el reclamo per evitar que la card del premi parpellegi abans
          // d'arribar a l'estat d'èxit.
          if (!autoClaimAttempted.current) {
            autoClaimAttempted.current = true;
            await claim();
          }
        }
      } catch {
        setError("network_error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const handleClaim = () => {
    if (!user || !promo) return;
    void claim();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-oliva-600">
        {t.common.loading}
      </div>
    );
  }

  // Èxit: regal reclamat → mostrar codi
  if (success) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="card text-center">
          <div className="mb-4 text-6xl">🍷</div>
          <h1 className="serif text-3xl text-terracota-800">
            {t.promo.successTitle}
          </h1>
          <p className="mt-2 text-oliva-700">{t.promo.successHint}</p>

          <div className="my-6 rounded-2xl border-2 border-dashed border-terracota-400 bg-terracota-50 px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-terracota-700">
              {lang === "ca" ? "Codi" : "Código"}
            </p>
            <p className="serif mt-1 text-4xl font-semibold tracking-widest text-terracota-800">
              {success.codigo_canje}
            </p>
          </div>

          <Link href="/dashboard" className="btn-primary w-full">
            {t.promo.seeMyPrizes}
          </Link>
          <InstallPWA />
        </div>
      </div>
    );
  }

  // Error
  if (error || !promo || !premio) {
    let mensaje = t.promo.errorNotFound;
    if (error === "promo_caducada") mensaje = t.promo.errorExpired;
    else if (error === "promo_inactiva") mensaje = t.promo.errorInactive;
    else if (error === "promo_ya_reclamada")
      mensaje = t.promo.errorAlreadyClaimed;
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

  const premioNombre = lang === "ca" ? premio.nombre_ca : premio.nombre_es;
  const premioDescripcion =
    lang === "ca" ? premio.descripcion_ca : premio.descripcion_es;
  const expiraDate = new Date(promo.expira_at);
  const expiraStr = expiraDate.toLocaleDateString(
    lang === "ca" ? "ca-ES" : "es-ES",
    { day: "numeric", month: "long", year: "numeric" },
  );

  return (
    <div className="mx-auto max-w-md py-6">
      {/* Header del restaurant */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-terracota-600 text-white">
          <span className="serif text-2xl font-semibold">À</span>
        </div>
        <h1 className="serif text-2xl text-terracota-800">
          L&apos;Àpat del Prat
        </h1>
        <p className="text-sm text-oliva-700">{t.tagline}</p>
      </div>

      {/* Caixa principal amb el premi */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terracota-600 to-terracota-800 p-8 text-center text-white shadow-lg">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm uppercase tracking-wider text-crema-100">
            🎁 {t.promo.title}
          </p>
          <div className="mt-3 text-6xl">🍷</div>
          <h2 className="serif mt-3 text-3xl font-semibold">{premioNombre}</h2>
          {premioDescripcion && (
            <p className="mt-2 text-sm text-crema-100">{premioDescripcion}</p>
          )}
          <p className="mt-5 inline-block rounded-full bg-white/15 px-3 py-1 text-xs text-crema-100">
            {tpl(t.promo.expiresOn, { date: expiraStr })}
          </p>
        </div>
      </div>

      {/* Botons segons si està logat */}
      <div className="mt-6 space-y-3">
        {user ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="btn-primary w-full text-lg"
          >
            {claiming ? t.common.loading : t.promo.claim}
          </button>
        ) : (
          <>
            <p className="text-center text-sm text-oliva-700">
              {t.promo.subtitleGuest}
            </p>
            <Link
              href={`/register?redirect=${encodeURIComponent(`/promo/${codigo}`)}`}
              className="btn-primary w-full text-lg"
            >
              {t.promo.claimAndRegister}
            </Link>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/promo/${codigo}`)}`}
              className="btn-secondary w-full"
            >
              {t.promo.alreadyAccount}
            </Link>
          </>
        )}
      </div>

      <InstallPWA />
    </div>
  );
}
