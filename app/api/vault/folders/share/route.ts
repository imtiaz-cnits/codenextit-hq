import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../integrations/supabase/client.server";

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

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    let canViewShare = isAdmin;

    if (!canViewShare) {
      const { data: fAccess } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .select("permission_level")
        .eq("client_id", clientId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fAccess?.permission_level === "edit") {
        canViewShare = true;
      }
    }

    if (!canViewShare) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: accessList, error } = await (supabaseAdmin
      .from("folder_access" as any) as any)
      .select("user_id, permission_level")
      .eq("client_id", clientId);
    if (error) throw error;

    return NextResponse.json(accessList || []);
  } catch (error: any) {
    console.error("GET folder share error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_id, shares } = await req.json();

    if (!client_id || !Array.isArray(shares)) {
      return NextResponse.json({ error: "client_id and shares list are required" }, { status: 400 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    let canShare = isAdmin;

    if (!canShare) {
      const { data: fAccess } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .select("permission_level")
        .eq("client_id", client_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fAccess?.permission_level === "edit") {
        canShare = true;
      }
    }

    if (!canShare) {
      return NextResponse.json({ error: "Forbidden. You do not have share access to this folder." }, { status: 403 });
    }

    // Sync sharing relationships
    // 1. Delete existing shares
    const { error: deleteErr } = await (supabaseAdmin
      .from("folder_access" as any) as any)
      .delete()
      .eq("client_id", client_id);
    if (deleteErr) throw deleteErr;

    // 2. Insert new shares
    if (shares.length > 0) {
      const records = shares.map((s: any) => ({
        client_id,
        user_id: s.user_id,
        permission_level: s.permission_level || "view"
      }));

      const { error: insertErr } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .insert(records);
      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST folder share error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
