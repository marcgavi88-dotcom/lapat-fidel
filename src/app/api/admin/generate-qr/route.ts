import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Genera un código único alfanumérico
function generarCodigo(len = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: NextRequest) {
  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });

  // Verificar admin
  const { data: prof } = await supa.from("profiles").select("is_admin").eq("id", auth.user.id).single();
  if (!prof?.is_admin) return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });

  const { importe, croquetas } = await req.json();
  const importeNum = Number(importe);
  if (!importeNum || importeNum <= 0) {
    return NextResponse.json({ ok: false, error: "importe_invalido" }, { status: 400 });
  }

  // Croquetes: enter ≥ 0 (per defecte 0). Les capem a 999 per prudència.
  let croquetasNum = Number.isFinite(Number(croquetas)) ? Math.floor(Number(croquetas)) : 0;
  if (croquetasNum < 0) croquetasNum = 0;
  if (croquetasNum > 999) croquetasNum = 999;

  // 2.5 puntos por euro, redondeado
  const puntos = Math.round(importeNum * 2.5);
  const codigo = generarCodigo();
  const expiraAt = new Date();
  expiraAt.setHours(expiraAt.getHours() + 72); // 72h de validez

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("qr_codes")
    .insert({
      codigo,
      importe_euros: importeNum,
      puntos,
      croquetas: croquetasNum,
      es_menu: false, // deprecated: ja no s'utilitza
      expira_at: expiraAt.toISOString(),
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, qr: data });
}
