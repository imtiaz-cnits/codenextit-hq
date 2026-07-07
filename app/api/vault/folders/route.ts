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
        .insert({ 
          company_name: "Internal Settings",
          created_by: user.id
        });
    }

    // Fetch all folders
    const { data: allClients, error: clientsErr } = await supabaseAdmin
      .from("clients")
      .select("id, company_name, created_by, parent_id")
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
    const folderAccessMap = new Map<string, string>((folderAccess || []).map((fa: any) => [fa.client_id as string, fa.permission_level as string]));

    // Fetch credential access for current user to find which folders contain credentials shared with this user
    const { data: userCredentialAccess } = await (supabaseAdmin
      .from("credential_access" as any) as any)
      .select("credential_id")
      .eq("staff_id", user.id);
    const sharedCredIds = (userCredentialAccess || []).map((ca: any) => ca.credential_id);

    // Fetch client_id of credentials that are created by the user or shared with the user
    let userRelatedCreds: any[] = [];
    if (sharedCredIds.length > 0) {
      const { data } = await (supabaseAdmin
        .from("credentials" as any) as any)
        .select("client_id")
        .or(`created_by.eq.${user.id},id.in.(${sharedCredIds.join(",")})`)
        .not("client_id", "is", null);
      userRelatedCreds = data || [];
    } else {
      const { data } = await (supabaseAdmin
        .from("credentials" as any) as any)
        .select("client_id")
        .eq("created_by", user.id)
        .not("client_id", "is", null);
      userRelatedCreds = data || [];
    }

    const foldersWithRelatedCreds = new Set<string>(
      userRelatedCreds.map((rc: any) => rc.client_id).filter(Boolean)
    );

    // 1. Build initial visible folder IDs (explicitly owned, shared, or containing shared credentials)
    const initVisibleIds = new Set<string>();
    for (const c of allClients || []) {
      const isCreator = c.created_by === user.id;
      const hasExplicit = folderAccessMap.has(c.id);
      const hasRelatedCreds = foldersWithRelatedCreds.has(c.id);

      if (isCreator || hasExplicit || hasRelatedCreds) {
        initVisibleIds.add(c.id);
      }
    }

    // Initialize resolved visible folders (downward inheritance disabled for strict folder privacy)
    const resolvedVisibleIds = new Set<string>(initVisibleIds);

    // 3. Expand upwards (Ancestors): If a child folder is visible, all its ancestors must be visible to navigate.
    let addedNew = true;
    while (addedNew) {
      addedNew = false;
      for (const c of allClients || []) {
        if (resolvedVisibleIds.has(c.id) && c.parent_id && !resolvedVisibleIds.has(c.parent_id)) {
          resolvedVisibleIds.add(c.parent_id);
          addedNew = true;
        }
      }
    }

    // Filter visible folders
    const visibleFolders = (allClients || []).filter((c: any) => resolvedVisibleIds.has(c.id));

    const foldersWithPermission = visibleFolders.map((c: any) => {
      let permission = "view";

      if (c.created_by === user.id) {
        permission = "edit";
      } else if (folderAccessMap.has(c.id)) {
        permission = folderAccessMap.get(c.id) || "view";
      }

      return {
        id: c.id,
        company_name: c.company_name,
        permission_level: permission,
        parent_id: c.parent_id
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

    const { company_name, parent_id } = await req.json();
    if (!company_name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({ 
        company_name: company_name.trim(),
        created_by: user.id,
        parent_id: parent_id || null
      })
      .select("id, company_name, parent_id")
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

    const { id, company_name, parent_id } = await req.json();
    if (!id || !company_name?.trim()) {
      return NextResponse.json({ error: "ID and Folder name are required" }, { status: 400 });
    }

    // Validate parent_id to prevent cyclic reference cycles
    if (parent_id) {
      if (parent_id === id) {
        return NextResponse.json({ error: "Forbidden. A folder cannot be its own parent." }, { status: 400 });
      }

      // Read all folders to construct the hierarchy tree
      const { data: allFolders } = await supabaseAdmin.from("clients").select("id, parent_id");
      const folderMap = new Map((allFolders || []).map((f: any) => [f.id, f.parent_id]));
      let currentParent = parent_id;
      while (currentParent) {
        if (currentParent === id) {
          return NextResponse.json({ error: "Forbidden. Cannot move a folder into one of its own subfolders." }, { status: 400 });
        }
        currentParent = folderMap.get(currentParent) || null;
      }
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("created_by, company_name")
      .eq("id", id)
      .maybeSingle();

    if (client?.company_name === "Internal Settings") {
      return NextResponse.json({ error: "Forbidden. System folder cannot be renamed." }, { status: 403 });
    }

    const isCreator = client?.created_by === user.id;
    let canRename = isCreator || (isAdmin && !client?.created_by);

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

    const updateFields: any = { company_name: company_name.trim() };
    if (parent_id !== undefined) {
      updateFields.parent_id = parent_id || null;
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(updateFields)
      .eq("id", id)
      .select("id, company_name, parent_id")
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
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("created_by, company_name")
      .eq("id", id)
      .maybeSingle();

    if (client?.company_name === "Internal Settings") {
      return NextResponse.json({ error: "Forbidden. System folder cannot be deleted." }, { status: 403 });
    }

    const isCreator = client?.created_by === user.id;
    let canDelete = isCreator || (isAdmin && !client?.created_by);

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
