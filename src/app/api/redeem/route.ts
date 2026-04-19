import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { premio_id } = await req.json();
  if (!premio_id) return NextResponse.json({ ok: false, error: "missing_premio" }, { status: 400 });

  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });

  const { data, error } = await supa.rpc("canjear_premio", {
    p_premio_id: premio_id,
    p_user_id: auth.user.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
