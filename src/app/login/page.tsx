"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";
import { PremiosPreview } from "@/components/PremiosPreview";

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qr");
  const redirectTo = searchParams.get("redirect") || (qrCode ? `/qr/${qrCode}` : "/dashboard");
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(callbackError ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supa = createSupabaseBrowser();
    const { error: loginError } = await supa.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  const handleForgot = async () => {
    if (!email) {
      setError("Introdueix el teu email primer / Introduce tu email primero");
      return;
    }
    const supa = createSupabaseBrowser();
    const { error: resetError } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });
    if (resetError) setError(resetError.message);
    else setError("Revisa el teu correu / Revisa tu correo");
  };

  return (
    <div className="mx-auto max-w-5xl py-8 md:py-14">
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <div>
          <h1 className="serif mb-2 text-3xl text-terracota-800 md:text-4xl">{t.login.title}</h1>
          <p className="mb-8 text-oliva-700">{t.login.subtitle}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-oliva-800">{t.login.email}</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-oliva-800">{t.login.password}</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
            </div>

            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t.common.loading : t.login.submit}
            </button>

            <button type="button" onClick={handleForgot} className="block w-full text-center text-sm text-oliva-700 hover:underline">
              {t.login.forgotPassword}
            </button>

            <p className="text-center text-sm text-oliva-700">
              {t.login.noAccount}{" "}
              <Link href={qrCode ? `/register?qr=${qrCode}` : "/register"} className="font-medium text-terracota-700 hover:underline">
                {t.login.registerHere}
              </Link>
            </p>
          </form>
        </div>

        <PremiosPreview />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-oliva-600">...</div>}>
      <LoginForm />
    </Suspense>
  );
}
