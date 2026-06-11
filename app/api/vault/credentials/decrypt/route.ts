import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../integrations/supabase/client.server";
import { decryptPassword } from "../../../../../lib/crypto-server";

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

// Helper to check if user has access to a folder
async function checkHasFolderAccess(userId: string, clientId: string, isAdmin: boolean): Promise<boolean> {
  const { data: folderAccess } = await (supabaseAdmin
    .from("folder_access" as any) as any)
    .select("id")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  if (folderAccess) return true;

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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body; // action is 'view' | 'copy'

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Check if credential exists
    const { data: cred, error: fetchErr } = await (supabaseAdmin
      .from("credentials" as any) as any)
      .select("id, encrypted_password, created_by, client_id")
      .eq("id", id)
      .single();

    if (fetchErr || !cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // Verify access permission:
    // User must be the creator OR directly share-granted.
    // If not personal (client_id is not null), admins get access, or users with folder access.
    const isCreator = cred.created_by === user.id;
    let hasAccess = isCreator;

    if (!hasAccess) {
      // Check direct credential access
      const { data: accessRecord } = await (supabaseAdmin
        .from("credential_access" as any) as any)
        .select("id")
        .eq("credential_id", id)
        .eq("staff_id", user.id)
        .maybeSingle();

      if (accessRecord) {
        hasAccess = true;
      }
    }

    if (!hasAccess && cred.client_id !== null) {
      const isAdmin = await checkIsSuperAdmin(user.id);
      hasAccess = await checkHasFolderAccess(user.id, cred.client_id, isAdmin);
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden. You do not have access to this credential." }, { status: 403 });
    }

    // Decrypt password
    let decrypted = "";
    try {
      decrypted = decryptPassword(cred.encrypted_password);
    } catch (decErr: any) {
      console.error("Decryption error:", decErr);
      return NextResponse.json({ error: "Failed to decrypt password. Secure key might be incorrect." }, { status: 500 });
    }

    // Write to audit log
    const { error: logErr } = await (supabaseAdmin
      .from("credential_audit_logs" as any) as any)
      .insert({
        credential_id: id,
        user_id: user.id,
        action: action || "view"
      });

    if (logErr) {
      console.error("Failed to write to audit log:", logErr);
    }

    return NextResponse.json({ password: decrypted });
  } catch (error: any) {
    console.error("Decrypt handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
