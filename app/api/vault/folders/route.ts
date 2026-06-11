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

// Helper to check if a user is a staff member (any role other than client)
async function checkIsStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.some((r: any) => r.role !== "client") ?? false;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Ensure "Internal Settings" folder exists
    const { data: existingInternal } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("company_name", "Internal Settings")
      .maybeSingle();

    if (!existingInternal) {
      await supabaseAdmin
        .from("clients")
        .insert({ company_name: "Internal Settings" });
    }

    let folders: any[] = [];

    if (isAdmin) {
      const { data, error } = await supabaseAdmin
        .from("clients")
        .select("id, company_name")
        .order("company_name");
      if (error) throw error;
      folders = (data || []).map(f => ({
        ...f,
        permission_level: "edit"
      }));
    } else {
      const { data: accessRows, error: accessErr } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .select("client_id, permission_level")
        .eq("user_id", user.id);
      if (accessErr) throw accessErr;

      const clientIds = (accessRows || []).map((a: any) => a.client_id);
      if (clientIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .select("id, company_name")
          .in("id", clientIds)
          .order("company_name");
        if (error) throw error;
        folders = (data || []).map(f => {
          const row = accessRows.find((r: any) => r.client_id === f.id);
          return {
            ...f,
            permission_level: row?.permission_level || "view"
          };
        });
      }
    }

    return NextResponse.json(folders);
  } catch (error: any) {
    console.error("GET folders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isStaff = await checkIsStaff(user.id);
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden. Only staff members can create folders." }, { status: 403 });
    }

    const { company_name } = await req.json();
    if (!company_name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({ company_name: company_name.trim() })
      .select("id, company_name")
      .single();
    if (error) throw error;

    // Auto-grant edit permission in folder_access for consistency
    await (supabaseAdmin
      .from("folder_access" as any) as any)
      .insert({
        client_id: data.id,
        user_id: user.id,
        permission_level: "edit"
      });

    return NextResponse.json({ ...data, permission_level: "edit" }, { status: 201 });
  } catch (error: any) {
    console.error("POST folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, company_name } = await req.json();
    if (!id || !company_name?.trim()) {
      return NextResponse.json({ error: "ID and Folder name are required" }, { status: 400 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    let canRename = isAdmin;

    if (!canRename) {
      const { data: fAccess } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .select("permission_level")
        .eq("client_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fAccess?.permission_level === "edit") {
        canRename = true;
      }
    }

    if (!canRename) {
      return NextResponse.json({ error: "Forbidden. You do not have edit permission for this folder." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update({ company_name: company_name.trim() })
      .eq("id", id)
      .select("id, company_name")
      .single();
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PUT folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    let canDelete = isAdmin;

    if (!canDelete) {
      const { data: fAccess } = await (supabaseAdmin
        .from("folder_access" as any) as any)
        .select("permission_level")
        .eq("client_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fAccess?.permission_level === "edit") {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden. You do not have edit access to delete this folder." }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
