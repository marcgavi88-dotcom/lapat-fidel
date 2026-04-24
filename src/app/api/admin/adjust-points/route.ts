import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/admin/adjust-points
 * Body: { user_id: string, delta: number, motivo: string }
 *
 * Només accessible per admins. Crida la RPC `ajustar_puntos_admin`
 * que fa les validacions i escriu el moviment amb tipo='ajuste_admin'.
 */
export async function POST(req: NextRequest) {
  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  }

  const { data: prof } = await supa
    .from("profiles")
    .select("is_admin, is_admin_limitado")
    .eq("id", auth.user.id)
    .single();
  if (!prof?.is_admin) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });
  }
  if (prof.is_admin_limitado) {
    return NextResponse.json({ ok: false, error: "admin_limitat" }, { status: 403 });
  }

  let body: { user_id?: string; delta?: number; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const userId = (body.user_id || "").trim();
  const delta = Math.trunc(Number(body.delta));
  const motivo = (body.motivo || "").trim();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "usuari_buit" }, { status: 400 });
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ ok: false, error: "delta_invalid" }, { status: 400 });
  }
  if (motivo.length < 3) {
    return NextResponse.json({ ok: false, error: "motiu_massa_curt" }, { status: 400 });
  }

  // Crida la RPC amb la sessió de l'admin (la RPC torna a comprovar is_admin
  // i fa totes les validacions de negoci).
  const { data, error } = await supa.rpc("ajustar_puntos_admin", {
    p_user_id: userId,
    p_delta: delta,
    p_motivo: motivo,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // La RPC retorna jsonb amb { ok, ... }
  const result = (data as unknown) as {
    ok: boolean;
    error?: string;
    saldo_anterior?: number;
    saldo_nou?: number;
    delta?: number;
  };
  if (!result?.ok) {
    return NextResponse.json(result ?? { ok: false, error: "rpc_buida" }, { status: 400 });
  }
  return NextResponse.json(result);
}
