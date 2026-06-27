import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../integrations/supabase/client.server";

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

    // Fetch all domains, join clients to get company_name, and profiles to get creator name
    const { data: domains, error: fetchErr } = await (supabaseAdmin
      .from("client_domains" as any) as any)
      .select(`
        *,
        clients:client_id (
          company_name
        ),
        profiles:created_by (
          full_name
        )
      `)
      .order("renewal_date", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Notification engine for domains expiring within 30 days (or their custom reminder_days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const d of (domains || [])) {
      const renewal = new Date(d.renewal_date);
      renewal.setHours(0, 0, 0, 0);
      const diffTime = renewal.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const remDays = d.reminder_days ?? 30;
      if (diffDays <= remDays && !d.auto_renew) {
        const year = renewal.getFullYear();
        const notifTitle = `Domain Expiry Warning: ${d.domain_name}`;
        
        // Check if we already notified for this domain and year
        const { data: existingNotif } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("title", notifTitle)
          .like("body", `%${year}%`)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          // Get all admin/super admin user IDs to notify
          const { data: admins } = await (supabaseAdmin
            .from("user_roles" as any) as any)
            .select("user_id")
            .in("role", ["super_admin"]);
          
          const recipientIds = new Set<string>((admins || []).map((a: any) => a.user_id as string));
          if (d.created_by) {
            recipientIds.add(d.created_by);
          }

          const expiryText = diffDays <= 0 ? "has EXPIRED" : `expires in ${diffDays} days`;
          const notifBody = `Domain "${d.domain_name}" ${expiryText} on ${d.renewal_date}. Please ensure renewal is completed. (${year})`;

          for (const recipientId of recipientIds) {
            await (supabaseAdmin
              .from("notifications" as any) as any)
              .insert({
                user_id: recipientId,
                title: notifTitle,
                body: notifBody,
                type: "warning",
                link: "/domains"
              });
          }
        }
      }
    }

    const formattedDomains = (domains || []).map((d: any) => ({
      id: d.id,
      domain_name: d.domain_name,
      client_id: d.client_id,
      folder_name: d.clients?.company_name || "Personal / Internal",
      registrar: d.registrar || "—",
      renewal_date: d.renewal_date,
      reminder_days: d.reminder_days ?? 30,
      auto_renew: !!d.auto_renew,
      price: d.price ? Number(d.price) : null,
      notes: d.notes || "",
      created_by_name: d.profiles?.full_name || "Unknown Staff",
      created_at: d.created_at
    }));

    return NextResponse.json(formattedDomains);
  } catch (error: any) {
    console.error("GET domains error:", error);
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
    const { domain_name, client_id, registrar, renewal_date, reminder_days, auto_renew, price, notes } = body;

    if (!domain_name || !renewal_date) {
      return NextResponse.json({ error: "Domain name and renewal date are required" }, { status: 400 });
    }

    const { data, error } = await (supabaseAdmin
      .from("client_domains" as any) as any)
      .insert({
        domain_name,
        client_id: client_id || null,
        registrar: registrar || "",
        renewal_date,
        reminder_days: reminder_days ? parseInt(reminder_days, 10) : 30,
        auto_renew: !!auto_renew,
        price: price ? parseFloat(price) : null,
        notes: notes || "",
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST domain error:", error);
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
    const { id, domain_name, client_id, registrar, renewal_date, reminder_days, auto_renew, price, notes } = body;

    if (!id || !domain_name || !renewal_date) {
      return NextResponse.json({ error: "ID, domain name, and renewal date are required" }, { status: 400 });
    }

    // Select current record to verify if renewal_date changed
    const { data: currentDomain } = await (supabaseAdmin
      .from("client_domains" as any) as any)
      .select("renewal_date, price, registrar, domain_name, client_id")
      .eq("id", id)
      .single();

    const { data, error } = await (supabaseAdmin
      .from("client_domains" as any) as any)
      .update({
        domain_name,
        client_id: client_id || null,
        registrar: registrar || "",
        renewal_date,
        reminder_days: reminder_days ? parseInt(reminder_days, 10) : 30,
        auto_renew: !!auto_renew,
        price: price ? parseFloat(price) : null,
        notes: notes || "",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Check if renewal_date was changed/extended
    if (currentDomain && (currentDomain as any).renewal_date !== renewal_date) {
      // 1. Sync with recurring_reminders
      // Sync by domain_id
      await (supabaseAdmin
        .from("recurring_reminders" as any) as any)
        .update({ due_date: renewal_date, updated_at: new Date().toISOString() })
        .eq("domain_id", id);
      
      // Sync by matching name
      await (supabaseAdmin
        .from("recurring_reminders" as any) as any)
        .update({ due_date: renewal_date, updated_at: new Date().toISOString() })
        .eq("category", "domain")
        .ilike("name", `%${domain_name}%`);

      // 2. Insert expense entry in transactions table
      const costAmount = price ? parseFloat(price) : ((currentDomain as any).price ? Number((currentDomain as any).price) : 0);
      await (supabaseAdmin
        .from("transactions" as any) as any)
        .insert({
          type: "expense",
          amount: costAmount,
          currency: "USD",
          category: "domain_renewal",
          description: `Domain Renewal: ${domain_name}. Registrar: ${registrar || (currentDomain as any).registrar || "—"}.`,
          date: new Date().toISOString().split("T")[0],
          client_id: client_id || (currentDomain as any).client_id || null,
          recorded_by: user.id
        });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("PUT domain error:", error);
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

    const { error } = await (supabaseAdmin
      .from("client_domains" as any) as any)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE domain error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
