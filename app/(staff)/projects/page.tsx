"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Progress } from "../../../components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Calendar as CalendarPicker } from "../../../components/ui/calendar";
import { formatCurrency, formatDate, formatRelativeDays } from "../../../lib/format";
import { Plus, Briefcase, Calendar, Loader2, ListChecks, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import Link from "next/link";

type Status = "planning" | "active" | "on_hold" | "completed" | "cancelled";
type Category = "mern" | "laravel_php" | "wordpress" | "ui_ux" | "technical_seo" | "geo" | "aeo" | "schema_audit" | "other";
interface Project {
  id: string; name: string; description: string | null; client_id: string | null;
  budget: number; deadline: string | null; status: Status; category: Category;
  currency: "BDT" | "USD"; progress: number;
}
interface Client { id: string; company_name: string; }

const CATEGORY_LABEL: Record<Category, string> = {
  mern: "MERN", laravel_php: "Laravel/PHP", wordpress: "WordPress", ui_ux: "UI/UX",
  technical_seo: "Technical SEO", geo: "GEO", aeo: "AEO", schema_audit: "Schema audit", other: "Other",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: p, error: e1 }, { data: c }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name"),
    ]);
    if (e1) toast.error(e1.message);
    setProjects((p ?? []) as Project[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";
  const statusVariant = (s: Status) => s === "active" ? "default" : s === "completed" ? "secondary" : s === "on_hold" ? "outline" : s === "cancelled" ? "destructive" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Track every active engagement, budget and deadline.</p>
        </div>
        <NewProjectSheet clients={clients} onCreated={load} />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />No projects yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{clientName(p.client_id)}</CardDescription>
                  </div>
                  <Badge variant={statusVariant(p.status) as never}>{p.status.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[p.category]}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {formatDate(p.deadline)} · {formatRelativeDays(p.deadline)}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-semibold">{formatCurrency(Number(p.budget), p.currency)}</span>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/tasks?project=${p.id}`}>
                      <ListChecks className="h-4 w-4 mr-1" /> Tasks
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProjectSheet({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    name: "", description: "", client_id: "", budget: "0", currency: "BDT" as "BDT" | "USD",
    deadline: "", status: "planning" as Status, category: "mern" as Category, progress: "0",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("projects").insert({
      name: f.name, description: f.description || null,
      client_id: f.client_id || null,
      budget: Number(f.budget) || 0,
      currency: f.currency, deadline: f.deadline || null,
      status: f.status, category: f.category,
      progress: Math.max(0, Math.min(100, Number(f.progress) || 0)),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setOpen(false);
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New project</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>New project</SheetTitle><SheetDescription>Spin up a new client engagement.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Fld>
          <Fld label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></Fld>
          <Fld label="Client">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Category">
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
            <Fld label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["planning", "active", "on_hold", "completed", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Fld label="Budget"><Input type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
            <Fld label="Progress %"><Input type="number" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} /></Fld>
          </div>
          <Fld label="Deadline">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !f.deadline && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {f.deadline ? format(new Date(f.deadline), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={f.deadline ? new Date(f.deadline) : undefined}
                  onSelect={(d) => setF({ ...f, deadline: d ? format(d, "yyyy-MM-dd") : "" })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </Fld>
          <SheetFooter>
            <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
