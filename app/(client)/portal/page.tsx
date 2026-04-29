"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Progress } from "../../../components/ui/progress";
import { Briefcase, Server, Receipt, LifeBuoy, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { formatCurrency, formatDate } from "../../../lib/format";

interface PortalData {
  client: { company_name: string; contact_person: string | null } | null;
  projects: Array<{ id: string; name: string; status: string; progress: number; deadline: string | null; budget: number; currency: string }>;
  invoiceStats: { outstanding: number; paid: number; currency: string }[];
  openTickets: number;
  infraSoonExpiring: number;
}

export default function ClientHome() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    if (!profile?.client_id) { setLoading(false); return; }
    const load = async () => {
      const [{ data: client }, { data: projects }, { data: invoices }, { count: tCount }, { data: infra }] = await Promise.all([
        supabase.from("clients").select("company_name, contact_person").eq("id", profile.client_id!).maybeSingle(),
        supabase.from("projects").select("id, name, status, progress, deadline, budget, currency").eq("client_id", profile.client_id!),
        supabase.from("invoices").select("total, paid_amount, currency, status").eq("client_id", profile.client_id!),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("client_id", profile.client_id!).neq("status", "closed"),
        supabase.from("infrastructure_assets").select("id, expires_at").eq("client_id", profile.client_id!),
      ]);

      const grouped = (invoices ?? []).reduce<Record<string, { outstanding: number; paid: number; currency: string }>>((acc, i) => {
        const k = i.currency;
        if (!acc[k]) acc[k] = { outstanding: 0, paid: 0, currency: k };
        acc[k].paid += Number(i.paid_amount ?? 0);
        acc[k].outstanding += Math.max(Number(i.total ?? 0) - Number(i.paid_amount ?? 0), 0);
        return acc;
      }, {});

      const soon = (infra ?? []).filter((a) => {
        if (!a.expires_at) return false;
        const days = (new Date(a.expires_at).getTime() - Date.now()) / 86400000;
        return days >= 0 && days <= 30;
      }).length;

      setData({
        client: client as any,
        projects: (projects ?? []) as any,
        invoiceStats: Object.values(grouped),
        openTickets: tCount ?? 0,
        infraSoonExpiring: soon,
      });
      setLoading(false);
    };
    void load();
  }, [profile?.client_id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!profile?.client_id || !data?.client) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /><CardTitle>Welcome to your portal</CardTitle></div>
          <CardDescription>Your account isn't linked to a client record yet. Ask the CodeNext team to link you and your projects, invoices and tickets will appear here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back, {profile.full_name}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">{data.client.company_name}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active projects" value={String(data.projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length)} icon={Briefcase} tone="primary" />
        {data.invoiceStats.slice(0, 1).map((s) => (
          <KpiCard key={s.currency} label={`Outstanding (${s.currency})`} value={formatCurrency(s.outstanding, s.currency)} icon={Receipt} tone={s.outstanding > 0 ? "warning" : "success"} />
        ))}
        <KpiCard label="Open tickets" value={String(data.openTickets)} icon={LifeBuoy} tone="info" />
        <KpiCard label="Renewals < 30d" value={String(data.infraSoonExpiring)} icon={Server} tone={data.infraSoonExpiring > 0 ? "warning" : "primary"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
          <CardDescription>Live progress across every active engagement</CardDescription>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No projects yet — your first engagement will appear here.</p>
          ) : (
            <div className="space-y-4">
              {data.projects.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                        {p.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {formatDate(p.deadline)}</span>}
                        <span>Budget: {formatCurrency(p.budget, p.currency)}</span>
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-mono font-semibold">{p.progress}%</span></div>
                    <Progress value={p.progress} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "primary" | "success" | "warning" | "info" }) {
  const cls = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning-foreground", info: "bg-info/10 text-info" }[tone];
  return (
    <Card><CardContent className="p-5 flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1 truncate">{value}</p>
      </div>
      <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-lg ${cls}`}><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: "default" | "secondary" | "outline" | "destructive"; icon?: any }> = {
    completed: { v: "default", icon: CheckCircle2 },
    in_progress: { v: "secondary" },
    planning: { v: "outline" },
    on_hold: { v: "outline" },
    cancelled: { v: "destructive" },
  };
  const cfg = map[status] ?? { v: "outline" };
  return <Badge variant={cfg.v} className="capitalize whitespace-nowrap">{cfg.icon && <cfg.icon className="h-3 w-3 mr-1" />}{status.replace("_", " ")}</Badge>;
}
