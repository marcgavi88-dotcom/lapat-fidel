import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/admin/delete-qr
 * Body: { qr_id: string }
 *
 * Esborra un QR generat des del panell admin. Casos d'ús: un QR generat
 * per error (import equivocat, croquetes equivocades) que encara no
 * s'ha bescanviat.
 *
 * Proteccions:
 *   - Només admins autenticats.
 *   - Només QRs NO usats (si està usat => hi ha moviments de punts i
 *     l'usuari ja ha rebut els punts; esborrar-lo trencaria l'historial).
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

  let body: { qr_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const qrId = (body.qr_id || "").trim();
  if (!qrId) {
    return NextResponse.json({ ok: false, error: "qr_buit" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Comprovem que existeix i que NO està usat.
  const { data: qr, error: findErr } = await admin
    .from("qr_codes")
    .select("id, codigo, usado")
    .eq("id", qrId)
    .single();
  if (findErr || !qr) {
    return NextResponse.json({ ok: false, error: "qr_no_existeix" }, { status: 404 });
  }
  if (qr.usado) {
    return NextResponse.json({ ok: false, error: "qr_ja_usat" }, { status: 400 });
  }

  const { error: delErr } = await admin
    .from("qr_codes")
    .delete()
    .eq("id", qrId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: { id: qr.id, codigo: qr.codigo } });
}
