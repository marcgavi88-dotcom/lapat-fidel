"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

function RegisterForm() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qr"); // si venimos de un QR, lo guardamos
  const promoCafe = searchParams.get("promo") === "cafe"; // QR físic de benvinguda
  const redirectTo =
    searchParams.get("redirect") ||
    (qrCode ? `/qr/${qrCode}` : promoCafe ? "/rewards" : "/dashboard");

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptaPromociones, setAcceptaPromociones] = useState(false);
  const [acceptaTerminos, setAcceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptaTerminos) {
      setError(t.register.errorTerms);
      return;
    }

    setLoading(true);
    const supa = createSupabaseBrowser();

    const { data, error: signUpError } = await supa.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellidos,
          telefono,
          acepta_promociones: acceptaPromociones,
          idioma: lang,
          // Flag per al trigger handle_new_user: si és true, crea
          // automàticament un canje de cafè de benvinguda.
          promo_benvinguda: promoCafe,
        },
        emailRedirectTo: `${window.location.origin}${redirectTo}`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Si Supabase tiene auto-confirm desactivado, habrá que confirmar por email
    if (data.session) {
      // Login automático
      router.push(redirectTo);
      router.refresh();
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="card text-center">
          <div className="mb-4 text-5xl">{promoCafe ? "☕" : "✉️"}</div>
          <h1 className="serif mb-2 text-2xl text-terracota-800">
            {promoCafe ? t.register.successWelcome : t.register.success}
          </h1>
          <p className="text-oliva-700">{email}</p>
          <Link href="/login" className="btn-primary mt-6">
            {t.nav.login}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6 md:py-10">
      <h1 className="serif mb-2 text-3xl text-terracota-800 md:text-4xl">{t.register.title}</h1>
      <p className="mb-6 text-oliva-700">{t.register.subtitle}</p>

      {qrCode && (
        <div className="mb-6 rounded-xl border border-terracota-200 bg-terracota-50 px-4 py-3 text-sm text-terracota-800">
          🎁 {t.qr.subtitleGuest}
        </div>
      )}

      {promoCafe && !qrCode && (
        <div className="mb-6 rounded-xl border border-terracota-200 bg-terracota-50 px-4 py-3 text-sm text-terracota-800">
          ☕ {t.register.bannerWelcome}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-oliva-800">{t.register.nombre}</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-oliva-800">{t.register.apellidos}</label>
            <input required value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-oliva-800">{t.register.telefono}</label>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-oliva-800">{t.register.email}</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-oliva-800">{t.register.password}</label>
          <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
          <p className="mt-1 text-xs text-oliva-600">{t.register.passwordMin}</p>
        </div>

        <label className="flex items-start gap-2 rounded-lg bg-white p-3 text-sm">
          <input type="checkbox" checked={acceptaTerminos} onChange={(e) => setAcceptaTerminos(e.target.checked)} className="mt-0.5" />
          <span>
            {t.register.terms} <span className="text-terracota-600">*</span>
          </span>
        </label>

        <label className="flex items-start gap-2 rounded-lg bg-white p-3 text-sm">
          <input type="checkbox" checked={acceptaPromociones} onChange={(e) => setAcceptaPromociones(e.target.checked)} className="mt-0.5" />
          <span>{t.register.promotions}</span>
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t.common.loading : t.register.submit}
        </button>

        <p className="text-center text-sm text-oliva-700">
          {t.register.already}{" "}
          <Link href={qrCode ? `/login?qr=${qrCode}` : "/login"} className="font-medium text-terracota-700 hover:underline">
            {t.register.loginHere}
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-oliva-600">...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
