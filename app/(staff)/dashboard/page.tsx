"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useMock } from "../../../lib/mock-store";
import { useAuth } from "../../../lib/auth-context";
import { formatCurrency } from "../../../lib/format";
import {
  TrendingUp, Users, Server, LifeBuoy, Plus, Receipt, Clock, FileText,
  ArrowUpRight, Activity, Briefcase, CheckCircle, ListTodo, CalendarDays
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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
  const { invoices, projects, tasks } = useMock();
  const { hasRole, profile } = useAuth();
  
  const isSuperAdmin = hasRole("super_admin");
  const isClient = hasRole("client");
  
  const revenueBDT = invoices.filter((i) => i.currency === "BDT" && i.status === "paid").reduce((s, i) => s + i.paid, 0);
  const revenueUSD = invoices.filter((i) => i.currency === "USD" && i.status === "paid").reduce((s, i) => s + i.paid, 0);

  const clientProjects = projects.filter(p => p.client_id === profile?.client_id);
  const clientInvoices = invoices.filter(i => i.client_id === profile?.client_id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening across the agency.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1.5" /> New lead</Button>
          <Button size="sm"><Receipt className="h-4 w-4 mr-1.5" /> Create invoice</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isSuperAdmin ? (
          <>
            <KpiCard label="Monthly Revenue (BDT)" value={formatCurrency(revenueBDT, "BDT")} delta="+12.4%" icon={TrendingUp} accent="success" />
            <KpiCard label="Monthly Revenue (USD)" value={formatCurrency(revenueUSD, "USD")} delta="+8.1%" icon={TrendingUp} accent="primary" />
            <KpiCard label="Active Clients" value="14" delta="+2 this month" icon={Users} accent="info" />
            <KpiCard label="Server Renewals < 30d" value="3" delta="2 critical" icon={Server} accent="warning" />
          </>
        ) : isClient ? (
          <>
            <KpiCard label="My Active Projects" value={clientProjects.length.toString()} delta="All on track" icon={Briefcase} accent="primary" />
            <KpiCard label="Unpaid Invoices" value={clientInvoices.filter(i => i.status !== 'paid').length.toString()} delta="Action required" icon={Receipt} accent="warning" />
            <KpiCard label="Open Tickets" value="2" delta="1 high priority" icon={LifeBuoy} accent="info" />
            <KpiCard label="Total Spent" value={formatCurrency(clientInvoices.reduce((s, i) => s + (i as any).amount, 0), "USD")} delta="Lifetime" icon={TrendingUp} accent="success" />
          </>
        ) : (
          <>
            <KpiCard label="Today's Attendance" value="Present" delta="Clocked in 09:12" icon={Clock} accent="success" />
            <KpiCard label="My Pending Tasks" value="8" delta="2 due today" icon={ListTodo} accent="warning" />
            <KpiCard label="Active Projects" value="4" delta="Contributing" icon={Briefcase} accent="primary" />
            <KpiCard label="Leave Balance" value="12 Days" delta="Remaining" icon={CalendarDays} accent="info" />
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

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump right in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { icon: TrendingUp, label: "Add New Lead" },
              { icon: Receipt, label: "Create Invoice" },
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
