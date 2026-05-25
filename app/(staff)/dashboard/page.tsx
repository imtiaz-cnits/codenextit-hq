"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useMock } from "../../../lib/mock-store";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../integrations/supabase/client";
import { formatCurrency, toLocalDateString, formatDate } from "../../../lib/format";
import {
  TrendingUp, Users, Server, LifeBuoy, Plus, Receipt, Clock, FileText,
  ArrowUpRight, Activity, Briefcase, CheckCircle, ListTodo, CalendarDays,
  LogIn, LogOut, Coffee
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { cn } from "../../../lib/utils";
import { DashboardSkeleton } from "../../../components/loading-skeletons";
import { BdClockWidget } from "../../../components/dashboard/bd-clock-widget";

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
    toggleClock, loading
  } = useMock();
  const { hasRole, profile, user } = useAuth();

  // Holidays from Supabase (multi-day ranges represented as one row per day)
  const [holidays, setHolidays] = useState<{ id?: string; date: string; name: string }[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("company_holidays" as any).select("*").order("date", { ascending: true });
      if (data) setHolidays(data as any);
    })();
  }, []);
  
  if (loading) return <DashboardSkeleton />;
  
  const isSuperAdmin = hasRole("super_admin");
  const isClient = hasRole("client");
  const t = toLocalDateString();
  
  // Super Admin Stats
  const revenueBDT = invoices.filter((i) => i.currency === "BDT" && i.status === "paid").reduce((s, i) => s + i.paid, 0);
  const revenueUSD = invoices.filter((i) => i.currency === "USD" && i.status === "paid").reduce((s, i) => s + i.paid, 0);
  
  const upcomingRenewals = infrastructure.filter(a => {
    if (!a.expires_at) return false;
    const days = (new Date(a.expires_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return days > 0 && days < 30;
  });

  // Client Stats
  const clientProjects = projects.filter(p => p.client_id === profile?.client_id);
  const clientInvoices = invoices.filter(i => i.client_id === profile?.client_id);

  // Staff Stats
  const todayAttendance = attendance.find(a => a.employee_id === currentEmployee?.id && a.date === t);
  const myPendingTasks = tasks.filter(tk => tk.assignee_id === currentEmployee?.id && tk.status !== 'done');
  const myActiveProjects = projects.filter(p => p.team_members?.includes(currentEmployee?.id || ""));

  // Leave Stats (20 days per year, 2 days per month logic)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const myApprovedLeaves = leaves.filter(l => 
    l.employee_id === currentEmployee?.id && 
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
  const todayDay = new Date(t).getDay();
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
    const sixtyDaysOut = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split("T")[0];
    return holidayGroups
      .filter(g => g.firstDate > t && g.firstDate <= sixtyDaysOut)
      .sort((a, b) => a.firstDate.localeCompare(b.firstDate))[0];
  })();

  // Days until next holiday
  const daysUntilHoliday = upcomingHoliday
    ? Math.ceil((new Date(upcomingHoliday.firstDate).getTime() - new Date(t).getTime()) / (24 * 3600 * 1000))
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
    const inMs = new Date(clockIn).getTime();
    const outMs = clockOut ? new Date(clockOut).getTime() : Date.now();
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
  const todayWorkedMin = currentEmployee
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
    if (!currentEmployee) return { weeklyWorkedMin: 0, weeklyLeaveCreditMin: 0, weeklyDaysClocked: 0, weeklyLeaveDays: 0 };
    const todayBD = new Date(t);
    const dayOfWeek = todayBD.getDay();
    const daysSinceSat = (dayOfWeek + 1) % 7;
    const sat = new Date(todayBD);
    sat.setDate(todayBD.getDate() - daysSinceSat);
    const satStr = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
    const myWeekAtt = attendance.filter(a =>
      a.employee_id === currentEmployee.id &&
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
        userName={profile?.full_name?.split(" ")[0] || "User"}
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
            <KpiCard label="Server Renewals < 30d" value={upcomingRenewals.length.toString()} delta={`${upcomingRenewals.filter(r => (new Date(r.expires_at!).getTime() - new Date().getTime()) / 86400000 < 7).length} critical`} icon={Server} accent="warning" />
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
                              ? `Clocked out at ${new Date(todayAttendance.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                              : `Clocked in at ${new Date(todayAttendance.clock_in!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`)
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sprint Burn-down</CardTitle>
                <CardDescription>Tasks remaining vs planned for this week</CardDescription>
              </div>
              <Badge variant="secondary"><Activity className="h-3 w-3 mr-1" /> On track</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={burndownData}>
                <defs>
                  <linearGradient id="planned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.22 285)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.55 0.22 285)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="actual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.16 155)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.7 0.16 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" stroke="currentColor" />
                <YAxis className="text-xs" stroke="currentColor" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="planned" stroke="oklch(0.55 0.22 285)" fill="url(#planned)" strokeWidth={2} />
                <Area type="monotone" dataKey="actual" stroke="oklch(0.7 0.16 155)" fill="url(#actual)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {!isClient && currentEmployee ? (
          <div className="space-y-4">
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
                      ? `${new Date(todayAttendance.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} → ${new Date(todayAttendance.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                      : `Started ${new Date(todayAttendance.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · still clocked in`)
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
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Jump right in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentEmployee && (
                <Button
                  variant={todayAttendance && !todayAttendance.clock_out ? "outline" : "default"}
                  className={cn(
                    "w-full justify-start font-bold mb-2",
                    todayAttendance && !todayAttendance.clock_out ? "border-primary text-primary hover:bg-primary/5" : "bg-primary hover:bg-primary/90"
                  )}
                  onClick={() => toggleClock(currentEmployee.id)}
                >
                  {todayAttendance && !todayAttendance.clock_out ? (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Clock Out
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Clock In
                    </>
                  )}
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5">Today</Badge>
                </Button>
              )}
              {[
                ...(isSuperAdmin ? [
                  { icon: TrendingUp, label: "Add New Lead" },
                  { icon: Receipt, label: "Create Invoice" },
                ] : []),
                { icon: Clock, label: "Log Time" },
                { icon: LifeBuoy, label: "New Ticket" },
                { icon: FileText, label: "New Quotation" },
              ].map((a) => (
                <Button key={a.label} variant="outline" className="w-full justify-start">
                  <a.icon className="h-4 w-4 mr-2" />
                  {a.label}
                  <ArrowUpRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, icon: Icon, accent }: {
  label: string; value: string; delta: string;
  icon: any;
  accent: "primary" | "success" | "warning" | "info";
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
  }[accent];
  return (
    <Card className="shadow-card">
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

function HoursCard({ label, workedMin, leaveCreditMin = 0, targetMin, progress, subtitle, isActive, officeRange, isOnLeave, isHalfDayLeave }: {
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
    <Card className="shadow-card overflow-hidden">
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
            <span className={`font-mono font-bold ${tone.text}`}>{progress.toFixed(0)}%</span>
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
