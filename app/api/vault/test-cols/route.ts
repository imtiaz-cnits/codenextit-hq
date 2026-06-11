import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../integrations/supabase/client.server";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("employees" as any)
      .select("*")
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message });
    }

    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      return NextResponse.json({ success: true, columns: keys, sample: data[0] });
    }

    return NextResponse.json({ success: true, message: "No rows in employees table" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
