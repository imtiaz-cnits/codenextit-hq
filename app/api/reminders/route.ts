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

// Helper to calculate the next due date based on current due date and billing cycle
function calculateNextDueDate(currentDateStr: string, cycle: string): string {
  const date = new Date(currentDateStr);
  if (isNaN(date.getTime())) return currentDateStr;
  
  if (cycle === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else if (cycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  }
  
  return date.toISOString().split("T")[0];
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

    // Fetch all reminders
    const { data: reminders, error: fetchErr } = await (supabaseAdmin
      .from("recurring_reminders" as any) as any)
      .select(`
        *,
        clients:client_id (
          company_name
        ),
        profiles:created_by (
          full_name
        )
      `)
      .order("due_date", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Notification Engine for reminders due soon
    const now = new Date();

    for (const r of (reminders || [])) {
      let dueTimestamp: Date;
      if (r.due_time) {
        dueTimestamp = new Date(`${r.due_date}T${r.due_time}`);
      } else {
        dueTimestamp = new Date(`${r.due_date}T23:59:59`);
      }

      const diffMs = dueTimestamp.getTime() - now.getTime();
      const remVal = r.reminder_value ?? r.reminder_days ?? 7;
      const remUnit = r.reminder_unit || "days";

      let diffUnits = 0;
      if (remUnit === "minutes") {
        diffUnits = diffMs / (1000 * 60);
      } else if (remUnit === "hours") {
        diffUnits = diffMs / (1000 * 60 * 60);
      } else {
        diffUnits = diffMs / (1000 * 60 * 60 * 24);
      }

      // If it is within reminder threshold
      if (diffUnits <= remVal) {
        const notifTitle = `Upcoming Renewal/Bill: ${r.name}`;
        
        // Check if we already notified for this exact reminder and due date
        const { data: existingNotif } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("title", notifTitle)
          .like("body", `%${r.due_date}%`)
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          // Get all admin/super admin user IDs to notify
          const { data: admins } = await (supabaseAdmin
            .from("user_roles" as any) as any)
            .select("user_id")
            .in("role", ["super_admin"]);
          
          const recipientIds = new Set<string>((admins || []).map((a: any) => a.user_id as string));
          if (r.created_by) {
            recipientIds.add(r.created_by);
          }

          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const relativeText = diffDays < 0 
            ? `is OVERDUE` 
            : diffDays === 0 
              ? "is due TODAY" 
              : `is due in ${diffDays} days`;

          const notifBody = `Reminder: "${r.name}" (${r.category}) ${relativeText} on ${r.due_date}${r.due_time ? ` at ${r.due_time}` : ""}. Estimated cost: ${r.cost} ${r.currency}.`;

          for (const recipientId of recipientIds) {
            await (supabaseAdmin
              .from("notifications" as any) as any)
              .insert({
                user_id: recipientId,
                title: notifTitle,
                body: notifBody,
                type: diffDays <= 2 ? "danger" : "warning",
                link: "/reminders"
              });
          }
        }
      }
    }

    const formattedReminders = (reminders || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      provider: r.provider || "—",
      cost: r.cost ? Number(r.cost) : 0,
      currency: r.currency || "BDT",
      due_date: r.due_date,
      due_time: r.due_time || null,
      billing_cycle: r.billing_cycle || "monthly",
      auto_renew: !!r.auto_renew,
      client_id: r.client_id,
      company_name: r.clients?.company_name || "Internal / Office",
      reminder_days: r.reminder_days ?? r.reminder_value ?? 7,
      reminder_value: r.reminder_value ?? r.reminder_days ?? 7,
      reminder_unit: r.reminder_unit || "days",
      domain_id: r.domain_id || null,
      notes: r.notes || "",
      created_by_name: r.profiles?.full_name || "Unknown Staff",
      created_at: r.created_at
    }));

    return NextResponse.json(formattedReminders);
  } catch (error: any) {
    console.error("GET reminders error:", error);
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
    const { name, category, provider, cost, currency, due_date, due_time, billing_cycle, auto_renew, client_id, reminder_value, reminder_unit, domain_id, notes } = body;

    if (!name || !category || !due_date) {
      return NextResponse.json({ error: "Name, category and due date are required" }, { status: 400 });
    }

    const remVal = reminder_value ? parseInt(reminder_value, 10) : 7;
    const { data, error } = await (supabaseAdmin
      .from("recurring_reminders" as any) as any)
      .insert({
        name,
        category,
        provider: provider || null,
        cost: cost ? parseFloat(cost) : 0.00,
        currency: currency || "BDT",
        due_date,
        due_time: due_time || null,
        billing_cycle: billing_cycle || "monthly",
        auto_renew: !!auto_renew,
        client_id: client_id || null,
        reminder_days: remVal,
        reminder_value: remVal,
        reminder_unit: reminder_unit || "days",
        domain_id: domain_id || null,
        notes: notes || null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST reminder error:", error);
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
    const { id, name, category, provider, cost, currency, due_date, due_time, billing_cycle, auto_renew, client_id, reminder_value, reminder_unit, domain_id, notes, action } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Special action to mark a reminder as Paid and roll forward the date
    if (action === "mark_paid") {
      const { data: current, error: getErr } = await (supabaseAdmin
        .from("recurring_reminders" as any) as any)
        .select("name, category, cost, currency, provider, notes, due_date, billing_cycle, domain_id, client_id")
        .eq("id", id)
        .single();
      
      if (getErr || !current) {
        return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
      }

      const nextDate = calculateNextDueDate(current.due_date, current.billing_cycle);
      
      const { data, error } = await (supabaseAdmin
        .from("recurring_reminders" as any) as any)
        .update({
          due_date: nextDate,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Auto-record approved transaction in public.transactions
      let transactionCategory = "other";
      if (current.category === "utility") {
        transactionCategory = "utility";
      } else if (current.category === "domain") {
        transactionCategory = "domain_renewal";
      } else if (["software", "vps", "hosting", "subscription"].includes(current.category)) {
        transactionCategory = "software_license";
      }

      await (supabaseAdmin.from("transactions" as any) as any)
        .insert({
          type: "expense",
          amount: current.cost ? Number(current.cost) : 0,
          currency: current.currency || "BDT",
          category: transactionCategory,
          description: `Paid Bill: ${current.name}. Provider: ${current.provider || "—"}. Notes: ${current.notes || ""}`,
          date: new Date().toISOString().split("T")[0],
          client_id: current.client_id || null,
          recorded_by: user.id
        });

      // If it is a domain category reminder, sync with client_domains
      if (current.category === "domain") {
        if (current.domain_id) {
          await (supabaseAdmin.from("client_domains" as any) as any)
            .update({ renewal_date: nextDate, updated_at: new Date().toISOString() })
            .eq("id", current.domain_id);
        } else {
          await (supabaseAdmin.from("client_domains" as any) as any)
            .update({ renewal_date: nextDate, updated_at: new Date().toISOString() })
            .ilike("domain_name", `%${current.name}%`);
        }
      }

      return NextResponse.json({ success: true, next_due_date: nextDate, data });
    }

    // Regular full update
    if (!name || !category || !due_date) {
      return NextResponse.json({ error: "Name, category, and due date are required" }, { status: 400 });
    }

    const remVal = reminder_value ? parseInt(reminder_value, 10) : 7;
    const { data, error } = await (supabaseAdmin
      .from("recurring_reminders" as any) as any)
      .update({
        name,
        category,
        provider: provider || null,
        cost: cost ? parseFloat(cost) : 0.00,
        currency: currency || "BDT",
        due_date,
        due_time: due_time || null,
        billing_cycle,
        auto_renew: !!auto_renew,
        client_id: client_id || null,
        reminder_days: remVal,
        reminder_value: remVal,
        reminder_unit: reminder_unit || "days",
        domain_id: domain_id || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })

      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PUT reminder error:", error);
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
      .from("recurring_reminders" as any) as any)
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE reminder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
