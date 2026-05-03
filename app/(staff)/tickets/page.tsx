"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Plus, AlertCircle, Loader2, MessageSquare, ArrowRight } from "lucide-react";
import { formatDate } from "../../../lib/format";
import { toast } from "sonner";
import { TableSkeleton } from "../../../components/loading-skeletons";

type Status = "open" | "in_progress" | "waiting_client" | "resolved" | "closed";
type Priority = "low" | "normal" | "high" | "critical";
interface Ticket {
  id: string; subject: string; description: string | null;
  client_id: string | null; project_id: string | null;
  priority: Priority; status: Status; created_at: string;
}
interface Client { id: string; company_name: string; }

const STATUS_FLOW: Status[] = ["open", "in_progress", "waiting_client", "resolved", "closed"];
const STATUS_TONE: Record<Status, string> = {
  open: "bg-info/15 text-info", in_progress: "bg-primary/15 text-primary",
  waiting_client: "bg-warning/20 text-warning-foreground",
  resolved: "bg-success/15 text-success", closed: "bg-muted text-muted-foreground",
};
const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-chart-2/15 text-chart-2",
  high: "bg-warning/20 text-warning-foreground",
  critical: "bg-destructive/15 text-destructive",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: t, error }, { data: c }] = await Promise.all([
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name"),
    ]);
    if (error) toast.error(error.message);
    setTickets((t ?? []) as Ticket[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  async function advance(t: Ticket) {
    const idx = STATUS_FLOW.indexOf(t.status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (next === t.status) return;
    setTickets((prev) => prev.map((x) => x.id === t.id ? { ...x, status: next } : x));
    const { error } = await supabase.from("tickets").update({ status: next }).eq("id", t.id);
    if (error) { toast.error(error.message); void load(); }
    else toast.success(`Moved to ${next.replace("_", " ")}`);
  }

  const visible = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const counts = STATUS_FLOW.reduce((acc, s) => ({ ...acc, [s]: tickets.filter((t) => t.status === s).length }), {} as Record<Status, number>);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Inbound issues from clients with priority routing.</p>
        </div>
        <NewTicketSheet clients={clients} onCreated={load} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label="All" count={tickets.length} />
        {STATUS_FLOW.map((s) => (
          <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)} label={s.replace("_", " ")} count={counts[s]} />
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />No tickets here.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${PRIORITY_TONE[t.priority]}`}>
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium">{t.subject}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{clientName(t.client_id)} · {formatDate(t.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                        <Badge variant="secondary" className={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
                    <div className="mt-3 flex justify-end">
                      {t.status !== "closed" && (
                        <Button size="sm" variant="outline" onClick={() => advance(t)}>
                          Advance <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`rounded-lg border px-3 py-2 text-left transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>
      <div className="text-xs uppercase tracking-wider opacity-80 capitalize whitespace-nowrap">{label}</div>
      <div className="text-xl font-bold">{count}</div>
    </button>
  );
}

function NewTicketSheet({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    subject: "", description: "", client_id: "",
    priority: "normal" as Priority, status: "open" as Status,
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tickets").insert({
      subject: f.subject, description: f.description || null,
      client_id: f.client_id || null,
      priority: f.priority, status: f.status,
      created_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket created");
    setOpen(false);
    setF((p) => ({ ...p, subject: "", description: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New ticket</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>New ticket</SheetTitle><SheetDescription>Open an internal or client issue.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Subject"><Input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Fld>
          <Fld label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} /></Fld>
          <Fld label="Client">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Internal" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Priority">
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "normal", "high", "critical"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
            <Fld label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create ticket"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
