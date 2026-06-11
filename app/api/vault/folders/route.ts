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

    // Fetch all folders
    const { data: allClients, error: clientsErr } = await supabaseAdmin
      .from("clients")
      .select("id, company_name, created_by")
      .order("company_name");
    if (clientsErr) throw clientsErr;

    // Fetch all user roles to know who are admins/super_admins
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const isFolderCreatedByAdmin = (createdById: string | null) => {
      if (!createdById) return true; // System/default folders are admin-owned
      return adminUserIds.has(createdById);
    };

    // Fetch folder_access for current user
    const { data: folderAccess } = await (supabaseAdmin
      .from("folder_access" as any) as any)
      .select("client_id, permission_level")
      .eq("user_id", user.id);
    const folderAccessMap = new Map((folderAccess || []).map((fa: any) => [fa.client_id, fa.permission_level]));

    // Fetch credentials user created
    const { data: createdCreds } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .select("client_id")
      .eq("created_by", user.id);

    // Fetch credentials shared with user
    const { data: sharedCreds } = await (supabaseAdmin
      .from("credential_access" as any) as any)
      .select("credential_id")
      .eq("staff_id", user.id);

    const sharedCredIds = (sharedCreds || []).map((sc: any) => sc.credential_id);
    let sharedCredFolderIds: string[] = [];
    if (sharedCredIds.length > 0) {
      const { data: sharedCredsDetails } = await (supabaseAdmin
        .from("credentials" as any) as any)
        .select("client_id")
        .in("id", sharedCredIds);
      sharedCredFolderIds = (sharedCredsDetails || []).map((c: any) => c.client_id).filter(Boolean);
    }

    const visibleCredentialFolderIds = new Set([
      ...(createdCreds || []).map((c: any) => c.client_id).filter(Boolean),
      ...sharedCredFolderIds
    ]);

    // Visibility rules:
    // A folder 'c' is visible if:
    // 1. User is creator of the folder.
    // 2. User has explicit folder_access record.
    // 3. User is admin AND folder was created by an admin or system folder (created_by is null).
    // 4. User has access to at least one credential inside that folder (partial folder share visibility).
    const visibleFolders = (allClients || []).filter((c: any) => {
      const isCreator = c.created_by === user.id;
      const hasExplicit = folderAccessMap.has(c.id);
      const hasCredentialAccess = visibleCredentialFolderIds.has(c.id);

      if (isCreator || hasExplicit || hasCredentialAccess) {
        return true;
      }

      if (isAdmin && isFolderCreatedByAdmin(c.created_by)) {
        return true;
      }

      return false;
    });

    const foldersWithPermission = visibleFolders.map((c: any) => {
      let permission = "view";

      if (c.created_by === user.id) {
        permission = "edit";
      } else if (folderAccessMap.has(c.id)) {
        permission = folderAccessMap.get(c.id) || "view";
      } else if (isAdmin && isFolderCreatedByAdmin(c.created_by)) {
        permission = "edit";
      }

      return {
        id: c.id,
        company_name: c.company_name,
        permission_level: permission
      };
    });

    return NextResponse.json(foldersWithPermission);
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
      .insert({ 
        company_name: company_name.trim(),
        created_by: user.id
      })
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
