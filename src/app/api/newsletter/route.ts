import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const supa = createSupabaseServer();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });

  const { data: prof } = await supa.from("profiles").select("is_admin").eq("id", auth.user.id).single();
  if (!prof?.is_admin) return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });

  const { asunto, contenido_html } = await req.json();
  if (!asunto || !contenido_html) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "resend_no_configurado" }, { status: 500 });
  }

  const admin = createSupabaseAdmin();
  const { data: destinatarios } = await admin
    .from("profiles")
    .select("email, nombre")
    .eq("acepta_promociones", true);

  if (!destinatarios || destinatarios.length === 0) {
    return NextResponse.json({ ok: false, error: "sin_destinatarios" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  let enviados = 0;
  let fallados = 0;

  // Enviar en lotes para no superar límites
  for (const d of destinatarios) {
    try {
      const personalizado = contenido_html.replace(/\{\{nombre\}\}/g, d.nombre || "");
      await resend.emails.send({
        from: `L'Àpat del Prat <${from}>`,
        to: d.email,
        subject: asunto,
        html: personalizado + `
          <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999">
            Rebs aquest correu perquè et vas subscriure a les novetats de L'Àpat del Prat.
            Si no vols rebre més, respon a aquest correu amb "BAIXA".
          </p>`,
      });
      enviados++;
    } catch (e) {
      fallados++;
    }
  }

  await admin.from("newsletters").insert({
    asunto,
    contenido_html,
    destinatarios: enviados,
    enviada_por: auth.user.id,
  });

  return NextResponse.json({ ok: true, enviados, fallados: 0, total: destinatarios.length });
}
