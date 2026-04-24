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

  const { importe, croquetas, comensales } = await req.json();
  const importeNum = Number(importe);
  if (!importeNum || importeNum <= 0) {
    return NextResponse.json({ ok: false, error: "importe_invalido" }, { status: 400 });
  }

  // Comensals: enter ≥ 1 (per defecte 1). Cap a 50 per prudència.
  let comensalesNum = Number.isFinite(Number(comensales)) ? Math.floor(Number(comensales)) : 1;
  if (comensalesNum < 1) comensalesNum = 1;
  if (comensalesNum > 50) comensalesNum = 50;

  // Croquetes TOTALS del tiquet: enter ≥ 0. Es divideixen entre els comensals igual que l'import.
  let croquetasNum = Number.isFinite(Number(croquetas)) ? Math.floor(Number(croquetas)) : 0;
  if (croquetasNum < 0) croquetasNum = 0;
  if (croquetasNum > 999) croquetasNum = 999;

  // Punts i croquetes PER ESCANEIG (cada comensal s'endú el seu tall).
  // 2.5 punts per euro, redondeat. Amb N comensals, cadascú rep round((importe/N) * 2.5).
  const importePerEscaneig = importeNum / comensalesNum;
  const puntosPerEscaneig = Math.round(importePerEscaneig * 2.5);
  const croquetasPerEscaneig = Math.floor(croquetasNum / comensalesNum);

  const codigo = generarCodigo();
  const expiraAt = new Date();
  expiraAt.setHours(expiraAt.getHours() + 72); // 72h de validez

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("qr_codes")
    .insert({
      codigo,
      importe_euros: importeNum,
      puntos: puntosPerEscaneig,
      croquetas: croquetasPerEscaneig,
      es_menu: false, // deprecated: ja no s'utilitza
      expira_at: expiraAt.toISOString(),
      created_by: auth.user.id,
      max_usos: comensalesNum,
      usos: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, qr: data });
}
