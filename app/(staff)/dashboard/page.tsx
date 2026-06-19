"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useMock } from "../../../lib/mock-store";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../integrations/supabase/client";
import { formatCurrency, toLocalDateString, formatDate } from "../../../lib/format";
import {
  TrendingUp, Users, Server, LifeBuoy, Plus, Receipt, Clock, FileText,
  ArrowUpRight, Activity, Briefcase, CheckCircle, ListTodo, CalendarDays,
  Coffee
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { cn } from "../../../lib/utils";
import { DashboardSkeleton } from "../../../components/loading-skeletons";
import { BdClockWidget } from "../../../components/dashboard/bd-clock-widget";
import { DailyAyatWidget, DailyHadithWidget } from "../../../components/dashboard/daily-ayat-widget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../components/ui/dialog";


const burndownData = [
  { day: "Mon", planned: 100, actual: 100 },
  { day: "Tue", planned: 88, actual: 92 },
  { day: "Wed", planned: 76, actual: 78 },
  { day: "Thu", planned: 64, actual: 70 },
  { day: "Fri", planned: 52, actual: 55 },
  { day: "Sat", planned: 40, actual: 38 },
  { day: "Sun", planned: 28, actual: 22 },
];

export default function Dashboard() {
  const {
    invoices, projects, tasks, employees, attendance,
    leaves, clients, infrastructure, currentEmployee,
    loading
  } = useMock();
  const { hasRole, profile, user } = useAuth();
  const router = useRouter();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isWeeklyPopupOpen, setIsWeeklyPopupOpen] = useState(false);

  // Holidays & renewals fetching (optimized concurrently)
  const [holidays, setHolidays] = useState<{ id?: string; date: string; name: string }[]>([]);
  const [domains, setDomains] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [holidaysRes, sessionRes] = await Promise.all([
          supabase.from("company_holidays" as any).select("*").order("date", { ascending: true }),
          supabase.auth.getSession()
        ]);

        if (holidaysRes.data) {
          setHolidays(holidaysRes.data as any);
        }

        const session = sessionRes.data?.session;
        if (session?.access_token) {
          const res = await fetch("/api/domains", {
            headers: {
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setDomains(data || []);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard layout metrics:", err);
      }
    })();
  }, [user]);

  if (loading) return <DashboardSkeleton />;

  const isSuperAdmin = hasRole("super_admin");
  const isClient = hasRole("client");
  // Get Bangladesh-aware local date string (YYYY-MM-DD)
  const t = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== "disabled");
  }, [employees]);

  const targetEmployee = selectedEmployeeId && isSuperAdmin
    ? (employees.find(e => e.id === selectedEmployeeId) || currentEmployee)
    : currentEmployee;

  // Super Admin Stats
  const revenueBDT = invoices.filter((i) => i.currency === "BDT" && i.status === "paid").reduce((s, i) => s + i.paid, 0);
  const revenueUSD = invoices.filter((i) => i.currency === "USD" && i.status === "paid").reduce((s, i) => s + i.paid, 0);

  const getDaysRemaining = (dateStr: string) => {
    // Use Bangladesh time for consistent "today" calculation
    const bdNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    bdNow.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - bdNow.getTime()) / (1000 * 60 * 60 * 24));
  };

  const upcomingRenewals = useMemo(() => {
    // 1. Infrastructure assets expiring within 30 days
    const infraItems = infrastructure
      .filter(a => {
        if (!a.expires_at) return false;
        const days = getDaysRemaining(a.expires_at);
        return days > 0 && days <= 30;
      })
      .map(a => ({
        id: a.id,
        name: a.name,
        type: a.asset_type,
        date: a.expires_at!,
        daysLeft: getDaysRemaining(a.expires_at!)
      }));

    // 2. Client domains expiring within 30 days
    const domainItems = domains
      .filter(d => {
        const days = getDaysRemaining(d.renewal_date);
        return days <= 30; // Expired or expiring within 30 days
      })
      .map(d => ({
        id: d.id,
        name: d.domain_name,
        type: "domain",
        date: d.renewal_date,
        daysLeft: getDaysRemaining(d.renewal_date)
      }));

    return [...infraItems, ...domainItems];
  }, [infrastructure, domains]);

  const criticalRenewals15Count = useMemo(() => {
    return upcomingRenewals.filter(r => r.daysLeft <= 15).length;
  }, [upcomingRenewals]);

  // Client Stats
  const clientProjects = projects.filter(p => p.client_id === profile?.client_id);
  const clientInvoices = invoices.filter(i => i.client_id === profile?.client_id);

  // Staff Stats
  const todayAttendance = attendance.find(a => a.employee_id === targetEmployee?.id && a.date === t);

  // Active user's own attendance for Clock In/Out button is managed in attendance page

  const myPendingTasks = tasks.filter(tk => tk.assignee_id === currentEmployee?.id && tk.status !== 'done');
  const myActiveProjects = projects.filter(p => p.team_members?.includes(currentEmployee?.id || ""));

  // Leave Stats (20 days per year, 2 days per month logic)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const myApprovedLeaves = leaves.filter(l =>
    l.employee_id === targetEmployee?.id &&
    l.status === 'approved' &&
    new Date(l.from_date).getFullYear() === currentYear
  );

  const calculateDays = (start: string, end: string, isHalfDay?: boolean) => {
    if (isHalfDay) return 0.5;
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
  };

  const usedYearly = myApprovedLeaves.reduce((acc, l: any) => acc + calculateDays(l.from_date, l.to_date, l.is_half_day), 0);
  const usedMonthly = myApprovedLeaves
    .filter(l => new Date(l.from_date).getMonth() === currentMonth)
    .reduce((acc, l: any) => acc + calculateDays(l.from_date, l.to_date, l.is_half_day), 0);

  const leaveBalance = 20 - usedYearly;
  const monthlyBalanceRemaining = 2 - usedMonthly;

  const isOnLeaveToday = myApprovedLeaves.find(l => t >= l.from_date && t <= l.to_date);

  // Holiday detection — today is holiday? (multi-day ranges merge)
  const todayHoliday = holidays.find(h => h.date === t);
  const isTodayHoliday = !!todayHoliday;

  // Friday weekly off
  const todayDay = (parseDateSafely(t) || new Date(t)).getDay();
  const isWeeklyOff = todayDay === 5;

  // Group holidays into multi-day ranges sharing same base name
  const holidayGroups = useMemo(() => {
    const stripDayLabel = (n: string) => n.replace(/\s*\(Day\s+\d+\/\d+\)\s*$/i, "").trim();
    const groups: { baseName: string; days: typeof holidays; firstDate: string; lastDate: string }[] = [];
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    for (const h of sorted) {
      const base = stripDayLabel(h.name);
      const existing = groups.find(g => g.baseName === base);
      if (existing) existing.days.push(h);
      else groups.push({ baseName: base, days: [h], firstDate: h.date, lastDate: h.date });
    }
    groups.forEach(g => {
      g.firstDate = g.days[0].date;
      g.lastDate = g.days[g.days.length - 1].date;
    });
    return groups;
  }, [holidays]);

  // Find ongoing holiday (today is in range)
  const ongoingHoliday = holidayGroups.find(g => t >= g.firstDate && t <= g.lastDate);

  // Find next upcoming holiday (date > today, within 60 days)
  const upcomingHoliday = (() => {
    // We already have 't' which is Asia/Dhaka today (YYYY-MM-DD)
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString().split("T")[0];
    return holidayGroups
      .filter(g => g.firstDate > t && g.firstDate <= sixtyDaysOut)
      .sort((a, b) => a.firstDate.localeCompare(b.firstDate))[0];
  })();

  // Days until next holiday
  const daysUntilHoliday = upcomingHoliday
    ? getDaysRemaining(upcomingHoliday.firstDate)
    : null;

  // Detect if current BD time is before standard office start (11:00) — show "Yet to Clock In" instead of "Absent"
  const isBeforeOfficeStart = (() => {
    const officeStart = "11:00"; // matches global default; could fetch from workspace_settings
    const [sh, sm] = officeStart.split(":").map(Number);
    const bdParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const nh = parseInt(bdParts.find(p => p.type === "hour")?.value || "0");
    const nm = parseInt(bdParts.find(p => p.type === "minute")?.value || "0");
    return (nh * 60 + nm) < (sh * 60 + sm);
  })();

  // ==== Daily & Weekly Hour Calculations (Bangladesh time) ====
  const calcWorkedMinutes = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return 0;
    const parsedIn = parseDateSafely(clockIn);
    const parsedOut = clockOut ? parseDateSafely(clockOut) : new Date();
    if (!parsedIn || !parsedOut) return 0;
    const inMs = parsedIn.getTime();
    const outMs = parsedOut.getTime();
    if (isNaN(inMs) || isNaN(outMs) || outMs <= inMs) return 0;
    return Math.floor((outMs - inMs) / 60000);
  };

  const formatHrMin = (mins: number) => {
    if (mins < 1) return "0h 0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // Office hours: 11 AM – 7 PM (8 hours/day)
  const dailyTargetMin = 8 * 60;
  // Working week: Saturday to Thursday (6 days, Friday is weekend)
  const weeklyTargetMin = 6 * 8 * 60;

  // Today's worked minutes for current user
  const todayWorkedMin = targetEmployee
    ? calcWorkedMinutes(todayAttendance?.clock_in ?? null, todayAttendance?.clock_out ?? null)
    : 0;

  // Today's leave credit (full = 8h, half = 4h)
  const todayLeaveCreditMin = (() => {
    if (!isOnLeaveToday) return 0;
    return (isOnLeaveToday as any).is_half_day ? Math.round(dailyTargetMin / 2) : dailyTargetMin;
  })();

  // This week's worked minutes (Saturday → today, BD timezone — week starts Saturday)
  // Plus credit hours for approved leaves within the week
  const { weeklyWorkedMin, weeklyLeaveCreditMin, weeklyDaysClocked, weeklyLeaveDays } = (() => {
    if (!targetEmployee) return { weeklyWorkedMin: 0, weeklyLeaveCreditMin: 0, weeklyDaysClocked: 0, weeklyLeaveDays: 0 };
    const todayBD = new Date(t);
    const dayOfWeek = todayBD.getDay();
    const daysSinceSat = (dayOfWeek + 1) % 7;
    const sat = new Date(todayBD);
    sat.setDate(todayBD.getDate() - daysSinceSat);
    const satStr = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
    const myWeekAtt = attendance.filter(a =>
      a.employee_id === targetEmployee.id &&
      a.date >= satStr &&
      a.date <= t
    );
    const workedMin = myWeekAtt.reduce((acc, a) => acc + calcWorkedMinutes(a.clock_in ?? null, a.clock_out ?? null), 0);
    // Approved leaves within this week
    const weekLeaves = myApprovedLeaves.filter((l: any) => {
      // Any overlap between leave range and the week
      return l.from_date <= t && l.to_date >= satStr;
    });
    let leaveCreditMin = 0;
    let leaveDays = 0;
    weekLeaves.forEach((l: any) => {
      if (l.is_half_day) {
        // half day leave: credit 4h
        leaveCreditMin += Math.round(dailyTargetMin / 2);
        leaveDays += 0.5;
      } else {
        // count overlap days within the week (excluding Friday weekend)
        const start = l.from_date < satStr ? satStr : l.from_date;
        const end = l.to_date > t ? t : l.to_date;
        let cur = new Date(start);
        const last = new Date(end);
        while (cur <= last) {
          if (cur.getDay() !== 5) { // skip Friday
            leaveCreditMin += dailyTargetMin;
            leaveDays += 1;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return { weeklyWorkedMin: workedMin, weeklyLeaveCreditMin: leaveCreditMin, weeklyDaysClocked: myWeekAtt.length, weeklyLeaveDays: leaveDays };
  })();

  const weeklyHoursBreakdown = useMemo(() => {
    if (!targetEmployee) return [];

    const todayBD = new Date(t);
    const dayOfWeek = todayBD.getDay();
    const daysSinceSat = (dayOfWeek + 1) % 7;

    const sat = new Date(todayBD);
    sat.setDate(todayBD.getDate() - daysSinceSat);

    const breakdown = [];
    for (let i = 0; i < 6; i++) {
      const curDate = new Date(sat);
      curDate.setDate(sat.getDate() + i);
      const curDateStr = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, "0")}-${String(curDate.getDate()).padStart(2, "0")}`;

      const dayName = curDate.toLocaleDateString("bn-BD", { weekday: "long" });
      const dayNameEn = curDate.toLocaleDateString("en-US", { weekday: "long" });

      const att = attendance.find(a => a.employee_id === targetEmployee.id && a.date === curDateStr);
      const leave = myApprovedLeaves.find(l => curDateStr >= l.from_date && curDateStr <= l.to_date);
      const holiday = holidays.find(h => h.date === curDateStr);

      let status = "Absent";
      let statusColor = "text-rose-500 bg-rose-500/10 dark:bg-rose-500/5";
      let hoursDisplay = "0h 0m";
      let clockInTime = "—";
      let clockOutTime = "—";
      let isLate = false;

      if (holiday) {
        status = `Holiday (${holiday.name})`;
        statusColor = "text-blue-500 bg-blue-500/10 dark:bg-blue-500/5";
        hoursDisplay = "8h 0m (Credited)";
      } else if (leave) {
        const isHalf = (leave as any).is_half_day;
        status = isHalf ? "Half Day Leave" : "Approved Leave";
        statusColor = "text-amber-500 bg-amber-500/10 dark:bg-amber-500/5";
        hoursDisplay = isHalf ? "4h 0m (Credited)" : "8h 0m (Credited)";
      } else if (att) {
        clockInTime = att.clock_in ? (parseDateSafely(att.clock_in) || new Date(att.clock_in)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "—";
        clockOutTime = att.clock_out ? (parseDateSafely(att.clock_out) || new Date(att.clock_out)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "—";

        if (att.clock_in && targetEmployee) {
          try {
            const isMgmtOrAdmin = targetEmployee.department === "Management" || targetEmployee.designation === "Super Admin";
            if (!isMgmtOrAdmin) {
              const officeStart = targetEmployee.office_start || "11:00";
              const [startH, startM] = officeStart.split(":").map(Number);
              const inDate = parseDateSafely(att.clock_in) || new Date(att.clock_in);
              const dhakaStr = inDate.toLocaleTimeString("en-US", {
                timeZone: "Asia/Dhaka",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit"
              });
              const [clockInH, clockInM] = dhakaStr.split(":").map(Number);

              const startTimeInMinutes = startH * 60 + startM;
              const clockInTimeInMinutes = clockInH * 60 + clockInM;
              const allowedGrace = 15;

              if (clockInTimeInMinutes > (startTimeInMinutes + allowedGrace)) {
                isLate = true;
              }
            }
          } catch (e) {
            console.error("Error parsing late clock in time:", e);
          }
        }

        if (att.clock_in && !att.clock_out) {
          status = "Active Now";
          statusColor = "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5 font-bold animate-pulse";
        } else {
          status = "Present";
          statusColor = "text-emerald-600 bg-emerald-500/10 dark:bg-emerald-500/5";
        }

        const minutes = calcWorkedMinutes(att.clock_in ?? null, att.clock_out ?? null);
        hoursDisplay = formatHrMin(minutes);
      } else {
        if (curDateStr > t) {
          status = "Scheduled";
          statusColor = "text-slate-400 bg-slate-100 dark:bg-slate-800";
          hoursDisplay = "—";
        } else {
          status = "Absent";
          statusColor = "text-rose-500 bg-rose-500/10 dark:bg-rose-500/5";
        }
      }

      breakdown.push({
        date: curDateStr,
        dayName,
        dayNameEn,
        clockInTime,
        clockOutTime,
        status,
        statusColor,
        hoursDisplay,
        isLate
      });
    }

    return breakdown;
  }, [targetEmployee, t, attendance, myApprovedLeaves, holidays]);

  // Daily total = worked + leave credit (capped at target)
  const todayTotalMin = todayWorkedMin + todayLeaveCreditMin;
  const weeklyTotalMin = weeklyWorkedMin + weeklyLeaveCreditMin;

  const dailyProgress = Math.min(100, (todayTotalMin / dailyTargetMin) * 100);
  const weeklyProgress = Math.min(100, (weeklyTotalMin / weeklyTargetMin) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name || 'User'}. Here's what's happening.</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1.5" /> New lead</Button>
              <Button size="sm"><Receipt className="h-4 w-4 mr-1.5" /> Create invoice</Button>
            </>
          )}
        </div>
      </div>

      {/* BD Time & Date Widget */}
      <BdClockWidget
        userName={profile?.full_name || "User"}
        ongoingHoliday={ongoingHoliday}
        upcomingHoliday={upcomingHoliday}
        daysUntilHoliday={daysUntilHoliday}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {isSuperAdmin && (
          <>
            <KpiCard label="Monthly Revenue (BDT)" value={formatCurrency(revenueBDT, "BDT")} delta="+12.4%" icon={TrendingUp} accent="success" />
            <KpiCard label="Monthly Revenue (USD)" value={formatCurrency(revenueUSD, "USD")} delta="+8.1%" icon={TrendingUp} accent="primary" />
            <KpiCard label="Active Clients" value={clients.length.toString()} delta="Total registered" icon={Users} accent="info" />
            <KpiCard
              label="Renewals < 30d"
              value={upcomingRenewals.length.toString()}
              delta={
                upcomingRenewals.length > 0
                  ? (criticalRenewals15Count > 0
                    ? `${criticalRenewals15Count} critical (<15d)`
                    : `${upcomingRenewals.length} upcoming`)
                  : "No upcoming renewals"
              }
              icon={Server}
              accent={
                upcomingRenewals.length > 0
                  ? (criticalRenewals15Count > 0 ? "danger" : "warning")
                  : "muted"
              }
              onClick={() => router.push("/domains")}
            />
          </>
        )}

        {isClient ? (
          <>
            <KpiCard label="My Active Projects" value={clientProjects.length.toString()} delta="All on track" icon={Briefcase} accent="primary" />
            <KpiCard label="Unpaid Invoices" value={clientInvoices.filter(i => i.status !== 'paid').length.toString()} delta="Action required" icon={Receipt} accent="warning" />
            <KpiCard label="Open Tickets" value="0" delta="No active tickets" icon={LifeBuoy} accent="info" />
            <KpiCard label="Total Spent" value={formatCurrency(clientInvoices.reduce((s, i) => s + (i as any).amount, 0), "USD")} delta="Lifetime" icon={TrendingUp} accent="success" />
          </>
        ) : (
          <>
            <KpiCard
              label="Today's Attendance"
              value={
                isTodayHoliday
                  ? "Holiday"
                  : isWeeklyOff
                    ? "Weekend"
                    : isOnLeaveToday
                      ? "On Leave"
                      : (todayAttendance ? (todayAttendance.clock_out ? "Logged Out" : "Present") : (isBeforeOfficeStart ? "Yet to Clock In" : "Absent"))
              }
              delta={
                isTodayHoliday
                  ? `${ongoingHoliday?.baseName || todayHoliday?.name}${ongoingHoliday && ongoingHoliday.days.length > 1 ? ` · Day ${ongoingHoliday.days.findIndex(d => d.date === t) + 1}/${ongoingHoliday.days.length}` : ""}`
                  : isWeeklyOff
                    ? "Friday weekly off"
                    : isOnLeaveToday
                      ? "Approved Leave"
                      : (todayAttendance
                        ? (todayAttendance.clock_out
                          ? `Clocked out at ${(parseDateSafely(todayAttendance.clock_out) || new Date(todayAttendance.clock_out)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                          : `Clocked in at ${(parseDateSafely(todayAttendance.clock_in) || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`)
                        : (isBeforeOfficeStart ? "Office starts at 11:00 AM" : "Not yet clocked in"))
              }
              icon={isTodayHoliday || isWeeklyOff ? Coffee : Clock}
              accent={
                isTodayHoliday || isWeeklyOff
                  ? "info"
                  : isOnLeaveToday
                    ? "info"
                    : (todayAttendance ? (todayAttendance.clock_out ? "warning" : "success") : (isBeforeOfficeStart ? "info" : "warning"))
              }
            />
            {!isSuperAdmin && (
              <>
                <KpiCard label="My Pending Tasks" value={myPendingTasks.length.toString()} delta={`${myPendingTasks.filter(tk => tk.due_date === t).length} due today`} icon={ListTodo} accent="warning" />
                <KpiCard label="Active Projects" value={myActiveProjects.length.toString()} delta="Assigned to me" icon={Briefcase} accent="primary" />
                <KpiCard label="Leave Balance" value={`${leaveBalance} Days`} delta={`${monthlyBalanceRemaining} left this month`} icon={CalendarDays} accent="info" />
              </>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <DailyAyatWidget />
          <DailyHadithWidget />
        </div>

        {!isClient && (currentEmployee || isSuperAdmin) && (
          <div className="space-y-4">
            {isSuperAdmin && (
              <Card className="shadow-card border border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.01]">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Inspect Staff Hours</p>
                  <Select
                    value={selectedEmployeeId || (currentEmployee?.id || "me")}
                    onValueChange={v => setSelectedEmployeeId(v === (currentEmployee?.id || "me") ? "" : v)}
                  >
                    <SelectTrigger className="w-full bg-background border border-border/40 rounded-xl cursor-pointer h-10 text-xs shadow-none">
                      <SelectValue placeholder="Select staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={currentEmployee?.id || "me"} className="text-xs cursor-pointer">Me ({profile?.full_name || 'Admin'})</SelectItem>
                      {activeEmployees
                        .filter(e => e.id !== currentEmployee?.id)
                        .map(e => (
                          <SelectItem key={e.id} value={e.id} className="text-xs cursor-pointer">
                            {e.full_name} ({e.designation || e.department || 'Staff'})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
            <HoursCard
              label="Today's Hours"
              workedMin={todayWorkedMin}
              leaveCreditMin={todayLeaveCreditMin}
              targetMin={dailyTargetMin}
              progress={dailyProgress}
              officeRange="11 AM – 7 PM (8h)"
              isActive={!!todayAttendance?.clock_in && !todayAttendance?.clock_out}
              isOnLeave={!!isOnLeaveToday}
              isHalfDayLeave={!!(isOnLeaveToday as any)?.is_half_day}
              subtitle={
                todayAttendance?.clock_in
                  ? (todayAttendance.clock_out
                    ? `${(parseDateSafely(todayAttendance.clock_in) || new Date(todayAttendance.clock_in)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} → ${(parseDateSafely(todayAttendance.clock_out) || new Date(todayAttendance.clock_out)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                    : `Started ${(parseDateSafely(todayAttendance.clock_in) || new Date()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · still clocked in`)
                  : (isOnLeaveToday
                    ? ((isOnLeaveToday as any).is_half_day ? "½ day approved leave (4h credited)" : "Full day approved leave (8h credited)")
                    : "Not clocked in yet")
              }
            />
            <HoursCard
              label="This Week's Hours"
              workedMin={weeklyWorkedMin}
              leaveCreditMin={weeklyLeaveCreditMin}
              targetMin={weeklyTargetMin}
              progress={weeklyProgress}
              officeRange="Sat–Thu · 48h target"
              subtitle={`${weeklyDaysClocked} day${weeklyDaysClocked !== 1 ? "s" : ""} clocked${weeklyLeaveDays > 0 ? ` · ${weeklyLeaveDays} on leave` : ""} · ${formatHrMin(weeklyWorkedMin)} worked`}
              onClick={() => setIsWeeklyPopupOpen(true)}
            />
          </div>
        )}
      </div>
      <Dialog open={isWeeklyPopupOpen} onOpenChange={setIsWeeklyPopupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Weekly Hours Log (Saturday - Thursday)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Daily work hours breakdown for {targetEmployee?.full_name} this week.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 overflow-hidden rounded-xl border border-border/80">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/65 border-b border-border/80 text-xs font-bold text-muted-foreground">
                  <th className="p-3">Day & Date</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {weeklyHoursBreakdown.map((row) => (
                  <tr key={row.date} className="hover:bg-muted/20 transition-colors text-xs">
                    <td className="p-3 font-semibold">
                      <div>{row.dayNameEn}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{formatDate(row.date)}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span>{row.clockInTime}</span>
                        {row.isLate && (
                          <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-500/5 px-1.5 py-0.5 rounded-md">
                            LATE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono">{row.clockOutTime}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.statusColor}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">{row.hoursDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress bar */}
          {(() => {
            const isComplete = weeklyProgress >= 100;
            const barClass = isComplete
              ? "from-emerald-500 to-emerald-400"
              : weeklyProgress >= 50
                ? "from-primary/70 to-primary"
                : "from-amber-500 to-amber-400";
            const textClass = isComplete
              ? "text-emerald-600 dark:text-emerald-400"
              : weeklyProgress >= 50
                ? "text-primary"
                : "text-amber-600 dark:text-amber-400";
            const bgBorderClass = isComplete
              ? "bg-emerald-500/10 dark:bg-emerald-400/10 border-emerald-500/20"
              : weeklyProgress >= 50
                ? "bg-primary/10 border-primary/20"
                : "bg-amber-500/10 dark:bg-amber-400/10 border-amber-500/20";
            return (
              <div className="mt-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Weekly Target Progress</span>
                  <span className={`font-mono font-bold ${textClass}`}>
                    {weeklyProgress >= 100 ? "100%" : `${Math.min(99.9, Number(weeklyProgress.toFixed(1)))}%`}
                  </span>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden ${bgBorderClass} border`}>
                  <div
                    className={`h-full bg-gradient-to-r ${barClass} transition-all duration-500 rounded-full`}
                    style={{ width: `${weeklyProgress}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <div className="mt-0 p-3 bg-primary/[0.03] dark:bg-primary/[0.01] border border-primary/10 rounded-xl grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Total Worked</span>
              <strong className="text-primary font-mono text-sm">{formatHrMin(weeklyWorkedMin)}</strong>
            </div>
            <div className="border-l border-primary/10">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Leave Credit</span>
              <strong className="text-amber-600 font-mono text-sm">{formatHrMin(weeklyLeaveCreditMin)}</strong>
            </div>
            <div className="border-l border-primary/10">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Weekly Target</span>
              <strong className="text-slate-600 dark:text-slate-400 font-mono text-sm">{formatHrMin(weeklyTargetMin)}</strong>
            </div>
            <div className="border-l border-primary/10">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Grand Total</span>
              <strong className="text-foreground font-mono text-sm">{formatHrMin(weeklyWorkedMin + weeklyLeaveCreditMin)}</strong>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, delta, icon: Icon, accent, onClick }: {
  label: string; value: string; delta: string;
  icon: any;
  accent: "primary" | "success" | "warning" | "info" | "danger" | "muted";
  onClick?: () => void;
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    info: "bg-info/10 text-info",
    muted: "bg-slate-500/10 text-slate-500/70 border-slate-500/10",
  }[accent];
  return (
    <Card
      className={cn(
        "shadow-card transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-muted-foreground/20",
        accent === "danger" && "border-rose-500/40 bg-rose-500/10 dark:bg-rose-500/5 shadow-md shadow-rose-500/10",
        accent === "warning" && "border-amber-500/30 bg-amber-500/[0.02] dark:bg-amber-500/[0.01] shadow-sm shadow-amber-500/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{delta}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HoursCard({ label, workedMin, leaveCreditMin = 0, targetMin, progress, subtitle, isActive, officeRange, isOnLeave, isHalfDayLeave, onClick }: {
  label: string;
  workedMin: number;
  leaveCreditMin?: number;
  targetMin: number;
  progress: number;
  subtitle: string;
  isActive?: boolean;
  officeRange?: string;
  isOnLeave?: boolean;
  isHalfDayLeave?: boolean;
  onClick?: () => void;
}) {
  const totalMin = workedMin + leaveCreditMin;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const targetH = Math.floor(targetMin / 60);
  const remainingMin = Math.max(0, targetMin - totalMin);
  const remH = Math.floor(remainingMin / 60);
  const remM = remainingMin % 60;
  const isComplete = totalMin >= targetMin;

  // Color based on progress
  const tone = isComplete
    ? { bg: "bg-emerald-500/10 dark:bg-emerald-400/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", bar: "from-emerald-500 to-emerald-400" }
    : progress >= 50
      ? { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", bar: "from-primary/70 to-primary" }
      : { bg: "bg-amber-500/10 dark:bg-amber-400/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", bar: "from-amber-500 to-amber-400" };

  return (
    <Card
      className={cn(
        "shadow-card overflow-hidden transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                {label}
                {isActive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </p>
              {officeRange && (
                <span className="text-[10px] text-muted-foreground/70 font-medium">· {officeRange}</span>
              )}
            </div>
            <p className="text-3xl font-bold mt-1.5 font-mono tabular-nums">
              {h}<span className="text-muted-foreground text-xl">h</span> {m}<span className="text-muted-foreground text-xl">m</span>
              {leaveCreditMin > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (worked {formatHrMinInline(workedMin)} + leave {formatHrMinInline(leaveCreditMin)})
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              of {targetH}h target
              {!isComplete && remainingMin > 0 && (
                <span className={`ml-1.5 font-semibold ${tone.text}`}>· {remH}h {remM}m to go</span>
              )}
              {isComplete && <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">· target met ✓</span>}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${tone.bg} ${tone.text}`}>
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Status badges */}
        {(isOnLeave || isHalfDayLeave) && (
          <div className="flex flex-wrap gap-1.5">
            {isHalfDayLeave ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                ½ DAY LEAVE · 4h credited
              </Badge>
            ) : isOnLeave ? (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-bold">
                FULL DAY LEAVE · 8h credited
              </Badge>
            ) : null}
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className={`h-2 rounded-full overflow-hidden ${tone.bg} border ${tone.border}`}>
            <div
              className={`h-full bg-gradient-to-r ${tone.bar} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="italic truncate flex-1 mr-2">{subtitle}</span>
            <span className={`font-mono font-bold ${tone.text}`}>
              {progress >= 100 ? "100%" : `${Math.min(99.9, Number(progress.toFixed(1)))}%`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatHrMinInline(mins: number): string {
  if (mins < 1) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseDateSafely(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let normalized = dateStr.trim();
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }
  const date = new Date(normalized);
  if (!isNaN(date.getTime())) {
    return date;
  }
  try {
    const cleaned = normalized.replace(/\s+/g, "T");
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    console.error("Error parsing date safely:", e);
  }
  return null;
}
