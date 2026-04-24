import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const supa = createSupabaseAdmin();
  const { data: qr, error } = await supa
    .from("qr_codes")
    .select("codigo, puntos, importe_euros, es_menu, usado, expira_at, max_usos, usos, croquetas")
    .eq("codigo", codigo)
    .single();

  if (error || !qr) {
    return NextResponse.json({ ok: false, error: "qr_no_encontrado" }, { status: 404 });
  }

  const maxUsos = qr.max_usos ?? 1;
  const usos = qr.usos ?? 0;
  const restants = Math.max(maxUsos - usos, 0);

  // QRs multi-ús: només considerem 'usado' quan s'han esgotat tots els escanejos.
  if (qr.usado || restants === 0) {
    return NextResponse.json({ ok: false, error: "qr_ya_usado" }, { status: 410 });
  }
  if (new Date(qr.expira_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "qr_caducado" }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    qr: { ...qr, max_usos: maxUsos, usos, restants },
  });
}
