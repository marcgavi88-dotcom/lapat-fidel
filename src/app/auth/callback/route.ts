import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";

// Route handler que processa la tornada des del link de confirmació d'email
// de Supabase. Suporta dos formats:
//   1) Flux PKCE  → ?code=XXX                       (per defecte a @supabase/ssr)
//   2) Flux OTP   → ?token_hash=XXX&type=signup|... (si la plantilla del mail
//      usa {{ .SiteURL }}/auth/callback?token_hash=... en comptes de
//      {{ .ConfirmationURL }})
// Si tot va bé, redirigeix a l'URL de `next` (o a /dashboard per defecte).
// Si falla, redirigeix a /login amb un missatge d'error amigable.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Protecció: 'next' ha de ser una ruta relativa per evitar open-redirect
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard";

  const supabase = createSupabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Ni code ni token_hash: redirigim al login sense error explícit
  return NextResponse.redirect(`${origin}/login`);
}
