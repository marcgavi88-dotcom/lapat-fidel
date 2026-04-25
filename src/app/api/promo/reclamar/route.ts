import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Reclama una promo per a l'usuari autenticat. Genera un canje normal
// que apareix a "Els meus premis" i que l'admin valida a /admin/redemptions.
export async function POST(req: NextRequest) {
  const { codigo } = await req.json();
  if (!codigo) {
    return NextResponse.json(
      { ok: false, error: "missing_code" },
      { status: 400 },
    );
  }

  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  }

  const { data, error } = await supa.rpc("reclamar_promo", {
    p_codigo: codigo,
    p_user_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
