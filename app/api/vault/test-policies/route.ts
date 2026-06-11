import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../integrations/supabase/client.server";

export async function GET() {
  try {
    const { data: policies, error } = await supabaseAdmin.rpc("get_policies" as any);

    // If there is no custom RPC, we can query pg_policies catalog view directly using a raw SQL-like select if allowed,
    // or query system catalog via an RPC. But if RPC doesn't exist, we can try querying pg_catalog views.
    // Let's do a direct select on pg_policies or pg_rules since PostgREST exposes catalog sometimes, or run a query.
    // Wait, PostgREST does not usually expose pg_catalog views by default.
    // Let's see if we can do an RPC call or execute query. If we don't have get_policies RPC, let's write a simple query:
    const { data, error: queryError } = await supabaseAdmin
      .from("pg_policies" as any)
      .select("*");

    return NextResponse.json({ policies, queryError: queryError?.message, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
