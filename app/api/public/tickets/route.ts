import { supabaseAdmin } from "../../../../integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const PayloadSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  client_email: z.string().email().max(255).optional(),
  client_id: z.string().uuid().optional(),
  source: z.string().max(64).optional(),
  idempotency_key: z.string().min(8).max(128).optional(),
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature, X-Webhook-Secret, X-Idempotency-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  try {
    // Load webhook settings
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("ticket_webhook_settings")
      .select("secret, enabled")
      .eq("id", true)
      .maybeSingle();

    if (settingsErr || !settings) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503, headers });
    }
    if (!settings.enabled) {
      return NextResponse.json({ error: "Webhook disabled" }, { status: 403, headers });
    }

    const rawBody = await request.text();

    // Auth
    const sigHeader = request.headers.get("x-webhook-signature");
    const secretHeader = request.headers.get("x-webhook-secret");

    let authed = false;
    if (sigHeader) {
      const expected = createHmac("sha256", settings.secret).update(rawBody).digest("hex");
      authed = safeEqual(sigHeader.replace(/^sha256=/, ""), expected);
    } else if (secretHeader) {
      authed = safeEqual(secretHeader, settings.secret);
    }

    if (!authed) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers });
    }

    // Validate payload
    let json: unknown;
    try { json = JSON.parse(rawBody); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers }); }

    const parsed = PayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400, headers });
    }
    const p = parsed.data;

    // Idempotency
    const idempotencyKey = request.headers.get("x-idempotency-key") || p.idempotency_key || null;
    if (idempotencyKey) {
      const tag = `[idem:${idempotencyKey}]`;
      const { data: existing } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .ilike("description", `%${tag}%`)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, ticket_id: existing.id, deduped: true }, { status: 200, headers });
      }
    }

    // Resolve client
    let clientId: string | null = p.client_id ?? null;
    if (!clientId && p.client_email) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("email", p.client_email)
        .maybeSingle();
      clientId = client?.id ?? null;
    }

    const description = [
      p.description ?? "",
      p.source ? `\n\n— Submitted via ${p.source}` : "",
      p.client_email && !clientId ? `\nReporter email: ${p.client_email}` : "",
      idempotencyKey ? `\n[idem:${idempotencyKey}]` : "",
    ].join("").trim() || null;

    const { data: ticket, error: insertErr } = await supabaseAdmin
      .from("tickets")
      .insert({
        subject: p.subject,
        description,
        client_id: clientId,
        priority: p.priority ?? "normal",
        status: "open",
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true, ticket_id: ticket.id }, { status: 201, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers });
  }
}
