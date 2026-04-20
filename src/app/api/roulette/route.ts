import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });

  let tipo: "normal" | "pro" = "normal";
  try {
    const body = await req.json();
    if (body?.tipo === "pro") tipo = "pro";
  } catch {
    // si no ve body o no és JSON, assumim 'normal'
  }

  const { data, error } = await supa.rpc("girar_ruleta", {
    p_user_id: auth.user.id,
    p_tipo: tipo,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
