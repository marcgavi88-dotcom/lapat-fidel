import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/admin/delete-user
 * Body: { user_id: string }
 *
 * Hard delete: crida auth.admin.deleteUser() amb el service role.
 * Les taules relacionades s'esborren via ON DELETE CASCADE.
 *
 * Proteccions:
 *   - Només admins autenticats poden cridar.
 *   - Un admin NO es pot esborrar a si mateix.
 */
export async function POST(req: NextRequest) {
  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  }

  const { data: prof } = await supa
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single();
  if (!prof?.is_admin) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const userId = (body.user_id || "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "usuari_buit" }, { status: 400 });
  }
  if (userId === auth.user.id) {
    return NextResponse.json(
      { ok: false, error: "no_autoesborrat" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  // Comprovem que existeix un profile per a aquest id (per no cridar
  // deleteUser amb UUIDs arbitraris).
  const { data: target, error: findErr } = await admin
    .from("profiles")
    .select("id, email, nombre")
    .eq("id", userId)
    .single();
  if (findErr || !target) {
    return NextResponse.json({ ok: false, error: "usuari_no_existeix" }, { status: 404 });
  }

  // Hard delete a auth.users. Les FKs estan definides amb ON DELETE CASCADE,
  // per tant profiles, canjes, movimientos_puntos, stories, reviews,
  // invitaciones, etc. es netegen soles.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: { id: target.id, email: target.email, nombre: target.nombre },
  });
}
