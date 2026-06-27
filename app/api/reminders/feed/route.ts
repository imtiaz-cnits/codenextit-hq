import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../integrations/supabase/client.server";

// Dynamic calendar feed endpoint (.ics feed)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Secure token check
    if (token !== "cnit_reminders_key_2026") {
      return new Response("Unauthorized. Invalid calendar token.", { status: 401 });
    }

    // Fetch all active reminders from database
    const { data: reminders, error } = await (supabaseAdmin
      .from("recurring_reminders" as any) as any)
      .select(`
        *,
        clients:client_id (
          company_name
        )
      `)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Feed database error:", error);
      return new Response("Database fetch failed", { status: 500 });
    }

    // Format as YYYYMMDD or YYYYMMDDTHHMMSS
    const getStartDateICS = (dueDateStr: string, dueTime: string | null) => {
      const ymd = dueDateStr.replace(/-/g, "");
      if (dueTime) {
        const timeFormatted = dueTime.replace(/:/g, "").padEnd(6, "0").substring(0, 6);
        return `${ymd}T${timeFormatted}`;
      }
      return ymd;
    };

    // Helper to get end date (due_date + 1 day for all-day, or due_date at dueTime + 1 hour for timed)
    const getEndDateICS = (dueDateStr: string, dueTime: string | null) => {
      const date = new Date(dueDateStr);
      if (isNaN(date.getTime())) return dueDateStr.replace(/-/g, "");
      
      if (dueTime) {
        const ymd = dueDateStr.replace(/-/g, "");
        const timeParts = dueTime.split(":");
        let hours = parseInt(timeParts[0], 10) || 0;
        let minutes = parseInt(timeParts[1], 10) || 0;
        
        // Add 1 hour for duration representation
        hours = (hours + 1) % 24;
        const timeFormatted = `${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}00`;
        return `${ymd}T${timeFormatted}`;
      } else {
        date.setDate(date.getDate() + 1);
        return date.toISOString().split("T")[0].replace(/-/g, "");
      }
    };

    // Build the ICS text
    let icsLines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CodeNext IT//Reminders Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:CNIT Reminders & Renewals",
      "X-WR-TIMEZONE:Asia/Dhaka",
      "X-WR-CALDESC:Recurring utility bills, domain, and server renewal reminders.",
    ];

    for (const r of (reminders || [])) {
      const start = getStartDateICS(r.due_date, r.due_time);
      const end = getEndDateICS(r.due_date, r.due_time);
      const categoryLabel = r.category ? r.category.toUpperCase() : "REMINDER";
      const companyLabel = r.clients?.company_name || "Internal / Office";

      const summary = `[${categoryLabel}] ${r.name}`;
      const description = `Provider: ${r.provider || "—"}\\nCost: ${r.cost} ${r.currency}\\nCycle: ${r.billing_cycle}\\nClient/Company: ${companyLabel}\\nNotes: ${r.notes || "—"}`;
      
      icsLines.push("BEGIN:VEVENT");
      icsLines.push(`UID:cnit_reminder_${r.id}@codenextit.com`);
      if (r.due_time) {
        icsLines.push(`DTSTART;TZID=Asia/Dhaka:${start}`);
        icsLines.push(`DTEND;TZID=Asia/Dhaka:${end}`);
      } else {
        icsLines.push(`DTSTART;VALUE=DATE:${start}`);
        icsLines.push(`DTEND;VALUE=DATE:${end}`);
      }
      icsLines.push(`SUMMARY:${summary}`);
      icsLines.push(`DESCRIPTION:${description}`);
      icsLines.push("STATUS:CONFIRMED");

      // Add VALARM for reminder alert notifications
      const val = r.reminder_value ?? r.reminder_days ?? 7;
      const unit = r.reminder_unit || "days";
      let triggerStr = "";
      if (unit === "minutes") {
        triggerStr = `-PT${val}M`;
      } else if (unit === "hours") {
        triggerStr = `-PT${val}H`;
      } else {
        triggerStr = `-P${val}D`;
      }

      icsLines.push("BEGIN:VALARM");
      icsLines.push("ACTION:DISPLAY");
      icsLines.push(`DESCRIPTION:Reminder: ${summary}`);
      icsLines.push(`TRIGGER:${triggerStr}`);
      icsLines.push("END:VALARM");

      icsLines.push("END:VEVENT");
    }

    icsLines.push("END:VCALENDAR");

    // Output raw calendar text
    const calendarContent = icsLines.join("\r\n");

    return new Response(calendarContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cnit-reminders.ics"',
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Calendar feed error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
