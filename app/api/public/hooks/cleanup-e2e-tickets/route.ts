import { supabaseAdmin } from "../../../../../integrations/supabase/client.server";
import { NextResponse } from "next/server";

const RETENTION_HOURS = 24;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST() {
  try {
    const cutoffIso = new Date(
      Date.now() - RETENTION_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const orFilter = [
      "subject.ilike.E2E test ticket%",
      "subject.ilike.E2E smoke%",
      "description.ilike.%[idem:lovable-e2e%",
    ].join(",");

    const { data: doomed, error: selectErr } = await supabaseAdmin
      .from("tickets")
      .select("id, subject, created_at")
      .lt("created_at", cutoffIso)
      .or(orFilter);

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500, headers });
    }

    const ids = (doomed ?? []).map((t) => t.id);
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        deleted: 0,
        cutoff: cutoffIso,
        retention_hours: RETENTION_HOURS,
      }, { status: 200, headers });
    }

    await supabaseAdmin.from("ticket_comments").delete().in("ticket_id", ids);

    const { error: deleteErr } = await supabaseAdmin
      .from("tickets")
      .delete()
      .in("id", ids);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500, headers });
    }

    return NextResponse.json({
      ok: true,
      deleted: ids.length,
      cutoff: cutoffIso,
      retention_hours: RETENTION_HOURS,
    }, { status: 200, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers });
  }
}
