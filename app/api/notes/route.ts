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
      .select("client_id, permission_level")
      .eq("user_id", user.id);
    const folderAccessMap = new Map<string, string>(
      (folderAccess || []).map((fa: any) => [fa.client_id, fa.permission_level])
    );

    // Fetch all note_access records
    const { data: allAccess } = await (supabaseAdmin
      .from("note_access" as any) as any)
      .select("note_id, staff_id, permission_level");

    // Fetch all note_folder_access records (sharing records for custom folders)
    const { data: allFolderAccess } = await (supabaseAdmin
      .from("note_folder_access" as any) as any)
      .select("folder_id, staff_id, permission_level");

    // Fetch all custom folders
    const { data: folders } = await (supabaseAdmin
      .from("note_folders" as any) as any)
      .select("id, client_id, created_by");

    // Build the set of folder IDs visible to this user
    const visibleFolderIds = new Set<string>();
    (folders || []).forEach((f: any) => {
      const creatorId = f.created_by;
      const isCreatorAdmin = !creatorId || adminUserIds.has(creatorId);

      const isSharedWithUser = (allFolderAccess || []).some(
        (fa: any) => fa.folder_id === f.id && fa.staff_id === user.id
      );

      let isVisible = false;
      if (isAdmin) {
        if (isCreatorAdmin) isVisible = true;
        else if (isSharedWithUser) isVisible = true;
      } else {
        if (isCreatorAdmin) {
          if (isSharedWithUser) isVisible = true;
        } else {
          const isCreator = f.created_by === user.id;
          const hasClientAccess = f.client_id && folderAccessMap.has(f.client_id);
          if (isCreator || isSharedWithUser || hasClientAccess) {
            isVisible = true;
          }
        }
      }
      
      if (isVisible) {
        visibleFolderIds.add(f.id);
      }
    });

    // Fetch all notes
    const { data: allNotes, error: notesErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .select(`
        *,
        clients:client_id (
          id,
          company_name,
          created_by
        ),
        profiles:created_by (
          id,
          full_name
        )
      `)
      .order("updated_at", { ascending: false });

    if (notesErr) throw notesErr;

    // Filter notes: visible if in visibleFolderIds OR passes direct isolation checks
    const filteredNotes = (allNotes || []).filter((note: any) => {
      if (note.folder_id && visibleFolderIds.has(note.folder_id)) {
        return true;
      }

      const creatorId = note.created_by;
      const isCreatorAdmin = !creatorId || adminUserIds.has(creatorId);

      const isSharedDirectly = (allAccess || []).some(
        (a: any) => a.note_id === note.id && a.staff_id === user.id
      );

      if (isAdmin) {
        if (isCreatorAdmin) return true;
        return isSharedDirectly;
      } else {
        if (isCreatorAdmin) return isSharedDirectly;

        const isCreator = note.created_by === user.id;
        const hasFolderAccess = note.client_id && (
          folderAccessMap.has(note.client_id) || 
          note.clients?.created_by === user.id
        );

        return isCreator || isSharedDirectly || hasFolderAccess;
      }
    });

    const notesWithAccess = filteredNotes.map((note: any) => {
      // Group access rules for this note
      const sharedWith = (allAccess || [])
        .filter((a: any) => a.note_id === note.id)
        .map((a: any) => {
          const p = (profiles || []).find((prof: any) => prof.id === a.staff_id);
          return {
            staff_id: a.staff_id,
            full_name: p?.full_name || "Unknown Staff",
            permission_level: a.permission_level
          };
        });

      // User's own permission level determination:
      const isCreator = note.created_by === user.id;
      const userAccess = (allAccess || []).find(
        (a: any) => a.note_id === note.id && a.staff_id === user.id
      );

      const folderAccessRec = note.folder_id ? (allFolderAccess || []).find(
        (fa: any) => fa.folder_id === note.folder_id && fa.staff_id === user.id
      ) : null;

      const isCreatedByAdmin = !note.created_by || adminUserIds.has(note.created_by);

      let permission: "view" | "edit" = "view";
      if (
        isCreator || 
        (isAdmin && isCreatedByAdmin) || 
        userAccess?.permission_level === "edit" || 
        folderAccessRec?.permission_level === "edit"
      ) {
        permission = "edit";
      } else if (note.client_id !== null) {
        // Fallback to client folder permission level
        const folderPerm = folderAccessMap.get(note.client_id);
        const isFolderCreator = note.clients?.created_by === user.id;
        if (folderPerm === "edit" || isFolderCreator) {
          permission = "edit";
        }
      }

      // Enforce strict camp isolation rule: staff cannot edit admin notes, and admins cannot edit staff notes, unless shared with edit level
      if (isCreatedByAdmin !== isAdmin) {
        const hasExplicitEdit = userAccess?.permission_level === "edit" || folderAccessRec?.permission_level === "edit";
        if (!hasExplicitEdit) {
          permission = "view";
        }
      }

      return {
        id: note.id,
        title: note.title,
        content: note.content || "",
        client_id: note.client_id,
        client_name: note.clients?.company_name || null,
        folder_id: note.folder_id || null,
        created_by: note.created_by,
        creator_name: note.profiles?.full_name || "Unknown Staff",
        created_at: note.created_at,
        updated_at: note.updated_at,
        permission_level: permission,
        shared_with: sharedWith
      };
    });

    return NextResponse.json(notesWithAccess);
  } catch (error: any) {
    console.error("GET notes error:", error);
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
    const { title, content, client_id, folder_id, shared_staff, audio_url } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Insert note
    const { data: note, error: noteErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .insert({
        title,
        content: content || "",
        client_id: client_id || null,
        folder_id: folder_id || null,
        audio_url: audio_url || null,
        created_by: user.id
      })
      .select("id")
      .single();

    if (noteErr || !note) {
      throw noteErr || new Error("Failed to insert note record");
    }

    // Insert sharing relationships
    if (shared_staff && Array.isArray(shared_staff) && shared_staff.length > 0) {
      const accessRecords = shared_staff.map((s: any) => ({
        note_id: note.id,
        staff_id: s.staff_id,
        permission_level: s.permission_level || "view"
      }));

      const { error: accessErr } = await (supabaseAdmin
        .from("note_access" as any) as any)
        .insert(accessRecords);

      if (accessErr) {
        // Rollback insert if sharing fails
        await (supabaseAdmin.from("notes" as any) as any).delete().eq("id", note.id);
        throw accessErr;
      }
    }

    return NextResponse.json({ success: true, id: note.id }, { status: 201 });
  } catch (error: any) {
    console.error("POST note error:", error);
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
    const { id, title, content, client_id, folder_id, shared_staff, audio_url } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "ID and Title are required" }, { status: 400 });
    }

    // Get current note to verify access permissions
    const { data: existingNote, error: findErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .select("created_by, folder_id")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
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

    const creatorId = existingNote.created_by;
    const isCreatedByAdmin = !creatorId || adminUserIds.has(creatorId);
    const isCreator = creatorId === user.id;

    // Check parent folder edit access if note is in a folder
    let hasFolderEditAccess = false;
    if (existingNote.folder_id) {
      const { data: folderAccess } = await (supabaseAdmin
        .from("note_folder_access" as any) as any)
        .select("permission_level")
        .eq("folder_id", existingNote.folder_id)
        .eq("staff_id", user.id)
        .maybeSingle();
      if (folderAccess?.permission_level === "edit") {
        hasFolderEditAccess = true;
      }
    }

    // Check direct note edit access
    let hasNoteEditAccess = false;
    const { data: noteAccess } = await (supabaseAdmin
      .from("note_access" as any) as any)
      .select("permission_level")
      .eq("note_id", id)
      .eq("staff_id", user.id)
      .maybeSingle();
    if (noteAccess?.permission_level === "edit") {
      hasNoteEditAccess = true;
    }

    // General canEdit calculation:
    let canEdit = false;
    if (isCreatedByAdmin === isAdmin) {
      // Same camp: creator can edit, or user is admin (if both are admin), or has note/folder edit access
      canEdit = isCreator || isAdmin || hasNoteEditAccess || hasFolderEditAccess;
    } else {
      // Different camp: can ONLY edit if explicitly shared with edit permissions
      canEdit = hasNoteEditAccess || hasFolderEditAccess;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden. You do not have edit permission for this note." }, { status: 403 });
    }

    // Update note details
    const { error: updateErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .update({
        title,
        content: content || "",
        client_id: client_id || null,
        folder_id: folder_id || null,
        audio_url: audio_url || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // Synchronize access lists (only allowed for Creator/Owner or Admin)
    const isShareManager = isCreator || isAdmin;
    if (isShareManager) {
      const { error: deleteAccessErr } = await (supabaseAdmin
        .from("note_access" as any) as any)
        .delete()
        .eq("note_id", id);

      if (deleteAccessErr) throw deleteAccessErr;

      if (shared_staff && Array.isArray(shared_staff) && shared_staff.length > 0) {
        const accessRecords = shared_staff.map((s: any) => ({
          note_id: id,
          staff_id: s.staff_id,
          permission_level: s.permission_level || "view"
        }));

        const { error: accessErr } = await (supabaseAdmin
          .from("note_access" as any) as any)
          .insert(accessRecords);

        if (accessErr) throw accessErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT note error:", error);
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

    // Check existing note
    const { data: existingNote, error: findErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .select("created_by")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
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

    const creatorId = existingNote.created_by;
    const isCreatedByAdmin = !creatorId || adminUserIds.has(creatorId);

    // Only creator or matching admin camp user can delete
    const canDelete = creatorId === user.id || (isAdmin && isCreatedByAdmin);

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to delete this note." }, { status: 403 });
    }

    const { error } = await (supabaseAdmin
      .from("notes" as any) as any)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE note error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const { id, is_pinned, is_favorite } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify user has access to the note
    const { data: note, error: findErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .select("created_by, folder_id")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const isAdmin = await checkIsSuperAdmin(user.id);
    const isCreator = note.created_by === user.id;

    // Check if shared with user
    const { data: noteAccess } = await (supabaseAdmin
      .from("note_access" as any) as any)
      .select("permission_level")
      .eq("note_id", id)
      .eq("staff_id", user.id)
      .maybeSingle();

    const hasAccess = isAdmin || isCreator || !!noteAccess;

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden. You do not have access to this note." }, { status: 403 });
    }

    const updateData: any = {};
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    if (is_favorite !== undefined) updateData.is_favorite = is_favorite;

    const { error: updateErr } = await (supabaseAdmin
      .from("notes" as any) as any)
      .update(updateData)
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH note error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Trigger Next.js compilation re-evaluation: rebuild event

