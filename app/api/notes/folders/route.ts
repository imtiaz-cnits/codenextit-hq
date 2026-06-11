import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

// Helper to check if a user is a staff member (not a client)
async function checkIsStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.some((r: any) => r.role !== "client") ?? false;
}

// Helper to check if a user is an admin or super_admin
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

    const isStaff = await checkIsStaff(user.id);
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden. Staff access required." }, { status: 403 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Fetch all profiles for sharing details mapping
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name");

    // Fetch all user roles to distinguish Admin vs Staff camps
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    // Fetch folder_access for user (clients they can access)
    const { data: folderAccess } = await (supabaseAdmin
      .from("folder_access" as any) as any)
      .select("client_id")
      .eq("user_id", user.id);
    const userClientIds = new Set((folderAccess || []).map((fa: any) => fa.client_id));

    // Fetch note_folder_access (sharing records for custom folders)
    const { data: allFolderAccess } = await (supabaseAdmin
      .from("note_folder_access" as any) as any)
      .select("folder_id, staff_id, permission_level");

    // Fetch note_folders
    const { data: folders, error: foldersErr } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .select("*")
      .order("name", { ascending: true });

    if (foldersErr) throw foldersErr;

    // Filter folders visible to this user
    const filteredFolders = (folders || []).filter((f: any) => {
      const creatorId = f.created_by;
      const isCreatorAdmin = !creatorId || adminUserIds.has(creatorId);

      const isSharedWithUser = (allFolderAccess || []).some(
        (fa: any) => fa.folder_id === f.id && fa.staff_id === user.id
      );

      if (isAdmin) {
        // Admin viewer: sees other admin folders, or staff folders shared with them
        if (isCreatorAdmin) return true;
        return isSharedWithUser;
      } else {
        // Staff viewer: sees admin folders shared with them, or staff folders (created, shared, or client-linked)
        if (isCreatorAdmin) return isSharedWithUser;

        const isCreator = f.created_by === user.id;
        const hasClientAccess = f.client_id && userClientIds.has(f.client_id);
        return isCreator || isSharedWithUser || hasClientAccess;
      }
    });

    // Map sharing users (shared_with details) to each folder
    const foldersWithAccess = filteredFolders.map((f: any) => {
      const sharedWith = (allFolderAccess || [])
        .filter((fa: any) => fa.folder_id === f.id)
        .map((fa: any) => {
          const p = (profiles || []).find((prof: any) => prof.id === fa.staff_id);
          return {
            staff_id: fa.staff_id,
            full_name: p?.full_name || "Unknown Staff",
            permission_level: fa.permission_level
          };
        });

      return {
        ...f,
        shared_with: sharedWith
      };
    });

    return NextResponse.json(foldersWithAccess);
  } catch (error: any) {
    console.error("GET note folders error:", error);
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
      return NextResponse.json({ error: "Forbidden. Staff access required." }, { status: 403 });
    }

    const body = await req.json();
    const { name, client_id } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .insert({
        name,
        client_id: client_id || null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST note folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isStaff = await checkIsStaff(user.id);
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden. Staff access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, shared_staff } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Get current folder
    const { data: existingFolder } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .select("created_by")
      .eq("id", id)
      .maybeSingle();

    if (!existingFolder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Fetch user roles to identify Admin vs Staff camps
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const creatorId = existingFolder.created_by;
    const isCreatorAdmin = !creatorId || adminUserIds.has(creatorId);

    // Check if user has edit permission for this folder
    let canEdit = existingFolder.created_by === user.id || (isAdmin && isCreatorAdmin);
    
    if (!canEdit) {
      const { data: folderAccess } = await (supabaseAdmin
        .from("note_folder_access" as any) as any)
        .select("permission_level")
        .eq("folder_id", id)
        .eq("staff_id", user.id)
        .maybeSingle();

      if (folderAccess?.permission_level === "edit") {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to edit this folder." }, { status: 403 });
    }

    // Update folder details if name is provided
    if (name) {
      const { error } = await (supabaseAdmin
        .from("note_folders" as any) as any)
        .update({
          name,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    }

    // Synchronize access lists (re-insert all shared permissions)
    const { error: deleteAccessErr } = await (supabaseAdmin
      .from("note_folder_access" as any) as any)
      .delete()
      .eq("folder_id", id);

    if (deleteAccessErr) throw deleteAccessErr;

    if (shared_staff && Array.isArray(shared_staff) && shared_staff.length > 0) {
      const accessRecords = shared_staff.map((s: any) => ({
        folder_id: id,
        staff_id: s.staff_id,
        permission_level: s.permission_level || "view"
      }));

      const { error: accessErr } = await (supabaseAdmin
        .from("note_folder_access" as any) as any)
        .insert(accessRecords);

      if (accessErr) throw accessErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT note folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isStaff = await checkIsStaff(user.id);
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden. Staff access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { data: existingFolder } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .select("created_by")
      .eq("id", id)
      .maybeSingle();

    if (!existingFolder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);

    // Fetch user roles to identify Admin vs Staff camps
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    
    const adminUserIds = new Set(
      (userRoles || [])
        .filter((r: any) => r.role === "super_admin" || r.role === "admin")
        .map((r: any) => r.user_id)
    );

    const creatorId = existingFolder.created_by;
    const isCreatorAdmin = !creatorId || adminUserIds.has(creatorId);

    // Only creator or admin (for admin folders) can delete custom folders
    const canDelete = existingFolder.created_by === user.id || (isAdmin && isCreatorAdmin);

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to delete this folder." }, { status: 403 });
    }

    const { error } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE note folder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// Trigger Next.js compilation re-evaluation: rebuild event
