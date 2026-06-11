import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../integrations/supabase/client.server";

// Helper to authenticate user via JWT token in Authorization header
async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}

// Helper to check if a user is a super_admin or admin
async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.some((r: any) => r.role === "super_admin" || r.role === "admin") ?? false;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { data: logs, error: logsErr } = await (supabaseAdmin
      .from("credential_audit_logs" as any) as any)
      .select(`
        id,
        action,
        created_at,
        profiles (
          full_name
        ),
        credentials (
          title,
          client_id,
          clients (
            company_name
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (logsErr) throw logsErr;

    const mappedLogs = (logs || []).map((l: any) => {
      const profile = l.profiles;
      const credential = l.credentials;
      const folder = credential?.clients;

      return {
        id: l.id,
        staff_name: profile?.full_name || "Unknown Staff",
        credential_title: credential?.title || "Deleted Credential",
        folder_name: folder?.company_name || (credential?.client_id ? "Unknown Folder" : "Personal / Internal"),
        action: l.action,
        created_at: l.created_at
      };
    });

    return NextResponse.json(mappedLogs);
  } catch (error: any) {
    console.error("GET audit logs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
