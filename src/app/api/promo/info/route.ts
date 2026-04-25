import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Endpoint públic. Retorna les dades necessàries per renderitzar la pàgina
// /promo/[codigo] (nom del premi, descripció, data de caducitat).
export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const supa = createSupabaseAdmin();
  const { data: promo, error } = await supa
    .from("promos")
    .select(
      "codigo, expira_at, activa, descripcion_ca, descripcion_es, premio_id",
    )
    .ilike("codigo", codigo)
    .maybeSingle();

  if (error || !promo) {
    return NextResponse.json(
      { ok: false, error: "promo_no_existe" },
      { status: 404 },
    );
  }

  if (!promo.activa) {
    return NextResponse.json(
      { ok: false, error: "promo_inactiva" },
      { status: 410 },
    );
  }

  if (new Date(promo.expira_at) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "promo_caducada" },
      { status: 410 },
    );
  }

  const { data: premio } = await supa
    .from("premios")
    .select("nombre_ca, nombre_es, descripcion_ca, descripcion_es")
    .eq("id", promo.premio_id)
    .single();

  return NextResponse.json({
    ok: true,
    promo: {
      codigo: promo.codigo,
      expira_at: promo.expira_at,
      descripcion_ca: promo.descripcion_ca,
      descripcion_es: promo.descripcion_es,
    },
    premio: premio ?? null,
  });
}
