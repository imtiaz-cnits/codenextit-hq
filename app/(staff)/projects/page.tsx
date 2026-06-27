"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
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
import { CardGridSkeleton } from "../../../components/loading-skeletons";

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

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { Trash2, Edit, ExternalLink, Users } from "lucide-react";

export default function ProjectsPage() {
  const { user, hasRole, profile } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const isClient = hasRole("client");

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    if (!user) return;
    setLoading(true);
    
    let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
    
    if (isClient && profile?.client_id) {
      query = query.eq("client_id", profile.client_id);
    } else if (!isSuperAdmin) {
      // Temporarily disabled until team_members column is added to Supabase
      // query = query.contains("team_members", [user.id]);
    }

    const [{ data: p, error: e1 }, { data: c }] = await Promise.all([
      query,
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
        {isSuperAdmin && <NewProjectSheet clients={clients} onCreated={load} />}
      </div>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : projects.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />No projects yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card 
              key={p.id} 
              className="hover:shadow-elegant transition-all cursor-pointer group active:scale-[0.98]"
              onClick={() => setSelectedProject(p)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base group-hover:text-primary transition-colors">{p.name}</CardTitle>
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
                  <div className="flex items-center gap-1">
                    <Button 
                      onClick={(e) => e.stopPropagation()} 
                      asChild 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 px-2"
                    >
                      <Link href={`/tasks?project=${p.id}`}>
                        <ListChecks className="h-4 w-4 mr-1" /> Tasks
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedProject && (
        <ProjectDetailsDialog
          project={selectedProject}
          clients={clients}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={load}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}

function ProjectDetailsDialog({ project, clients, isOpen, onClose, onUpdate, isSuperAdmin }: { 
  project: Project; clients: Client[]; isOpen: boolean; onClose: () => void; onUpdate: () => void; isSuperAdmin: boolean 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ ...project, budget: project.budget.toString(), progress: project.progress.toString() });

  const clientName = clients.find((c) => c.id === project.client_id)?.company_name ?? "—";

  async function update(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("projects").update({
      name: f.name, description: f.description || null,
      client_id: f.client_id || null,
      budget: Number(f.budget) || 0,
      currency: f.currency, deadline: f.deadline || null,
      status: f.status, category: f.category,
      progress: Math.max(0, Math.min(100, Number(f.progress) || 0)),
    }).eq("id", project.id);
    
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Project updated");
    setIsEditing(false);
    onUpdate();
  }

  async function deleteProject() {
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    onClose();
    onUpdate();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between mr-6">
            <DialogTitle className="text-xl">{isEditing ? "Edit Project" : project.name}</DialogTitle>
            {!isEditing && isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete the project and all associated tasks.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          {!isEditing && <DialogDescription>{clientName} · {CATEGORY_LABEL[project.category]}</DialogDescription>}
        </DialogHeader>

        {isEditing ? (
          <form onSubmit={update} className="space-y-4 mt-4">
            <Fld label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Fld>
            <Fld label="Description"><Textarea value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></Fld>
            <Fld label="Client">
              <Select value={f.client_id || ""} onValueChange={(v) => setF({ ...f, client_id: v })}>
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
              <FlatDatePicker 
                date={f.deadline || ""} 
                onChange={(d) => setF({ ...f, deadline: d })} 
              />
            </Fld>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                <Badge variant={project.status === "active" ? "default" : "secondary" as any} className="capitalize">
                  {project.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Deadline</p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatDate(project.deadline)}
                  <span className="text-xs text-muted-foreground font-normal">({formatRelativeDays(project.deadline)})</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Budget</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(Number(project.budget), project.currency)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Category</p>
                <p className="text-sm font-medium">{CATEGORY_LABEL[project.category]}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Project Progress</span>
                <span className="font-bold text-primary">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>

            {project.description && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
                <div className="bg-muted/30 p-4 rounded-lg text-sm leading-relaxed border border-muted">
                  {project.description}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <Button asChild className="flex-1">
                <Link href={`/tasks?project=${project.id}`}>
                  <ListChecks className="h-4 w-4 mr-2" /> View Tasks
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
      <SheetContent className="flex flex-col h-full p-0 w-full sm:max-w-lg">
        <div className="py-3 px-6 border-b border-border/40 shrink-0">
          <SheetHeader>
            <SheetTitle>New project</SheetTitle>
            <SheetDescription>Spin up a new client engagement.</SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Fld label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Fld>
            <Fld label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></Fld>
            <Fld label="Client">
              <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Category">
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as Category })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v} className="cursor-pointer">{l}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld label="Status">
                <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>{["planning", "active", "on_hold", "completed", "cancelled"].map((s) => <SelectItem key={s} value={s} className="cursor-pointer">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Budget"><Input type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Fld>
              <Fld label="Currency">
                <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="BDT" className="cursor-pointer">BDT</SelectItem><SelectItem value="USD" className="cursor-pointer">USD</SelectItem></SelectContent>
                </Select>
              </Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Progress %"><Input type="number" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} /></Fld>
              <Fld label="Deadline">
                <FlatDatePicker
                  date={f.deadline}
                  onChange={(d) => setF({ ...f, deadline: d })}
                  placeholder="Select deadline"
                />
              </Fld>
            </div>
          </div>

          <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
            <SheetFooter className="mt-0">
              <Button type="submit" disabled={submitting} className="w-full cursor-pointer">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : "Create project"}</Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
