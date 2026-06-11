import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../integrations/supabase/client.server";
import { encryptPassword } from "../../../../lib/crypto-server";

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

// Helper to check folder edit access permission level
async function checkHasFolderEditAccess(userId: string, clientId: string, isAdmin: boolean): Promise<boolean> {
  const { data: folderAccess } = await (supabaseAdmin
    .from("folder_access" as any) as any)
    .select("permission_level")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  if (folderAccess?.permission_level === "edit") return true;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("created_by")
    .eq("id", clientId)
    .maybeSingle();

  if (client?.created_by === userId) return true;

  if (isAdmin) {
    if (!client?.created_by) return true; // System folder

    const { data: creatorRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", client.created_by);
    const isCreatorAdmin = creatorRole?.some((r: any) => r.role === "super_admin" || r.role === "admin") ?? false;
    if (isCreatorAdmin) return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Fetch all credential access list to filter / map sharing info
    const { data: allAccess } = await (supabaseAdmin
      .from("credential_access" as any) as any)
      .select("credential_id, staff_id, permission_level");

    // Fetch profiles for sharing details mapping
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name");

    // Fetch all folders
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, created_by");

    // Fetch folder_access for user
    const { data: folderAccess } = await (supabaseAdmin
      .from("folder_access" as any) as any)
      .select("client_id, permission_level")
      .eq("user_id", user.id);
    const folderAccessMap = new Map((folderAccess || []).map((fa: any) => [fa.client_id, fa.permission_level]));

    // Fetch all user roles to identify admins
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const isFolderCreatedByAdmin = (createdById: string | null) => {
      if (!createdById) return true; // System folders are admin-owned
      return adminUserIds.has(createdById);
    };

    // Filter visible folder IDs for this user
    const visibleFolderIds = new Set<string>();
    (clients || []).forEach((c: any) => {
      const isCreator = c.created_by === user.id;
      const hasExplicit = folderAccessMap.has(c.id);
      const isSystemOrAdminCreated = !c.created_by || adminUserIds.has(c.created_by);
      const isAdminAndSystem = isAdmin && isSystemOrAdminCreated;

      if (isCreator || hasExplicit || isAdminAndSystem) {
        visibleFolderIds.add(c.id);
      }
    });

    // Fetch credentials
    const { data: allCredentials, error: credErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (credErr) throw credErr;

    // Filter credentials based on access control rules:
    const filteredCredentials = (allCredentials || []).filter((c: any) => {
      const isCreator = c.created_by === user.id;
      const isSharedDirectly = (allAccess || []).some(
        (a: any) => a.credential_id === c.id && a.staff_id === user.id
      );

      if (isCreator || isSharedDirectly) return true;

      // If it belongs to a folder, user must have folder access
      if (c.client_id !== null && visibleFolderIds.has(c.client_id)) {
        return true;
      }

      return false;
    });

    const credsWithAccess = filteredCredentials.map((c: any) => {
      // Group access rules for this credential
      const access = (allAccess || [])
        .filter((a: any) => a.credential_id === c.id)
        .map((a: any) => {
          const p = (profiles || []).find((prof: any) => prof.id === a.staff_id);
          return {
            staff_id: a.staff_id,
            full_name: p?.full_name || "Unknown Staff",
            permission_level: a.permission_level
          };
        });

      // User's own permission level determination:
      const isCreator = c.created_by === user.id;
      const userAccess = (allAccess || []).find(
        (a: any) => a.credential_id === c.id && a.staff_id === user.id
      );

      let hasEditPermission = isCreator;
      if (!hasEditPermission) {
        if (c.client_id !== null) {
          const hasExplicitFolderEdit = folderAccessMap.get(c.client_id) === "edit";
          const isFolderCreator = (clients || []).find((f: any) => f.id === c.client_id)?.created_by === user.id;
          const isAdminOfAdminFolder = isAdmin && isFolderCreatedByAdmin((clients || []).find((f: any) => f.id === c.client_id)?.created_by);

          if (hasExplicitFolderEdit || isFolderCreator || isAdminOfAdminFolder) {
            hasEditPermission = true;
          }
        }
        if (!hasEditPermission && userAccess?.permission_level === "edit") {
          hasEditPermission = true;
        }
      }

      // But wait! Staff CANNOT edit/delete credentials created by admins!
      const isCredCreatedByAdmin = !c.created_by || adminUserIds.has(c.created_by);
      if (isCredCreatedByAdmin && !isAdmin) {
        hasEditPermission = false;
      }

      const permission = hasEditPermission ? "edit" : "view";

      return {
        id: c.id,
        title: c.title,
        category: c.category,
        client_id: c.client_id,
        url: c.url,
        username: c.username,
        notes: c.notes,
        custom_fields: c.custom_fields || [],
        created_by: c.created_by,
        created_at: c.created_at,
        updated_at: c.updated_at,
        has_password: !!c.encrypted_password,
        permission_level: permission,
        shared_with: access
      };
    });

    return NextResponse.json(credsWithAccess);
  } catch (error: any) {
    console.error("GET credentials error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, category, client_id, url, username, password, notes, shared_staff, custom_fields } = body;

    if (!title || !password) {
      return NextResponse.json({ error: "Title and password are required" }, { status: 400 });
    }

    // Verify permission to add:
    // If client_id is provided, must be Creator OR explicitly shared with edit access OR admin for admin-owned folder
    const isAdmin = await checkIsSuperAdmin(user.id);
    if (client_id) {
      const hasFolderEditAccess = await checkHasFolderEditAccess(user.id, client_id, isAdmin);
      if (!hasFolderEditAccess) {
        return NextResponse.json({ error: "Forbidden. You do not have edit access to this folder." }, { status: 403 });
      }
    }

    // Insert credential
    const encrypted = encryptPassword(password);
    const { data: cred, error: credErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .insert({
        title,
        category: category || "other",
        client_id: client_id || null,
        url: url || "",
        username: username || "",
        encrypted_password: encrypted,
        notes: notes || "",
        custom_fields: custom_fields || [],
        created_by: user.id
      })
      .select("id")
      .single();

    if (credErr || !cred) {
      throw credErr || new Error("Failed to insert credential record");
    }

    // Insert sharing relationships
    if (shared_staff && Array.isArray(shared_staff) && shared_staff.length > 0) {
      const accessRecords = shared_staff.map((s: any) => ({
        credential_id: cred.id,
        staff_id: s.staff_id,
        permission_level: s.permission_level || "view"
      }));

      const { error: accessErr } = await (supabaseAdmin
        .from("credential_access" as any) as any)
        .insert(accessRecords);

      if (accessErr) {
        // Rollback credential if sharing fails
        await (supabaseAdmin.from("credentials" as any) as any).delete().eq("id", cred.id);
        throw accessErr;
      }
    }

    return NextResponse.json({ success: true, id: cred.id }, { status: 201 });
  } catch (error: any) {
    console.error("POST credential error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, category, client_id, url, username, password, notes, shared_staff, custom_fields } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "ID and Title are required" }, { status: 400 });
    }

    // Get current credential to check ownership
    const { data: existingCred, error: findErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .select("client_id, created_by")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existingCred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    
    // Fetch all user roles to identify admins
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const isCredCreatedByAdmin = !existingCred.created_by || adminUserIds.has(existingCred.created_by);

    // Staff members cannot edit admin-created credentials
    if (isCredCreatedByAdmin && !isAdmin) {
      return NextResponse.json({ error: "Forbidden. Staff members cannot edit admin-created credentials." }, { status: 403 });
    }

    const isCreator = existingCred.created_by === user.id;
    let canEdit = isCreator;

    if (!canEdit) {
      // Check credential_access
      const { data: credAccess } = await (supabaseAdmin
        .from("credential_access" as any) as any)
        .select("permission_level")
        .eq("credential_id", id)
        .eq("staff_id", user.id)
        .maybeSingle();
      if (credAccess?.permission_level === "edit") {
        canEdit = true;
      }
    }

    if (!canEdit && existingCred.client_id !== null) {
      // Check folder edit access
      canEdit = await checkHasFolderEditAccess(user.id, existingCred.client_id, isAdmin);
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to modify this credential." }, { status: 403 });
    }

    // If folder destination is changed, verify edit access to the destination folder too
    if (client_id !== undefined && client_id !== existingCred.client_id) {
      if (client_id !== null) {
        const hasNewFolderEdit = await checkHasFolderEditAccess(user.id, client_id, isAdmin);
        if (!hasNewFolderEdit) {
          return NextResponse.json({ error: "Forbidden. You do not have edit access to the destination folder." }, { status: 403 });
        }
      }
    }

    const updateData: any = {
      title,
      category: category || "other",
      client_id: client_id || null,
      url: url || "",
      username: username || "",
      notes: notes || "",
      custom_fields: custom_fields || [],
      updated_at: new Date().toISOString()
    };

    if (password) {
      updateData.encrypted_password = encryptPassword(password);
    }

    // Update credential
    const { error: updateErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .update(updateData)
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Sync sharing relationships
    // 1. Delete existing ones
    const { error: deleteAccessErr } = await (supabaseAdmin
      .from("credential_access" as any) as any)
      .delete()
      .eq("credential_id", id);

    if (deleteAccessErr) throw deleteAccessErr;

    // 2. Insert new ones
    if (shared_staff && Array.isArray(shared_staff) && shared_staff.length > 0) {
      const accessRecords = shared_staff.map((s: any) => ({
        credential_id: id,
        staff_id: s.staff_id,
        permission_level: s.permission_level || "view"
      }));

      const { error: accessErr } = await (supabaseAdmin
        .from("credential_access" as any) as any)
        .insert(accessRecords);

      if (accessErr) throw accessErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT credential error:", error);
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

    // Get credential to check ownership
    const { data: existingCred, error: findErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .select("client_id, created_by")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existingCred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Fetch all user roles to identify admins
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const isCredCreatedByAdmin = !existingCred.created_by || adminUserIds.has(existingCred.created_by);

    // Staff members cannot delete admin-created credentials
    if (isCredCreatedByAdmin && !isAdmin) {
      return NextResponse.json({ error: "Forbidden. Staff members cannot delete admin-created credentials." }, { status: 403 });
    }

    const isCreator = existingCred.created_by === user.id;
    let canDelete = isCreator;

    if (!canDelete) {
      // Check credential_access edit
      const { data: credAccess } = await (supabaseAdmin
        .from("credential_access" as any) as any)
        .select("permission_level")
        .eq("credential_id", id)
        .eq("staff_id", user.id)
        .maybeSingle();
      if (credAccess?.permission_level === "edit") {
        canDelete = true;
      }
    }

    if (!canDelete && existingCred.client_id !== null) {
      // Check folder edit access
      canDelete = await checkHasFolderEditAccess(user.id, existingCred.client_id, isAdmin);
    }

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to delete this credential." }, { status: 403 });
    }

    const { error } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE credential error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
