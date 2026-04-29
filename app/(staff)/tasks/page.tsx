"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Plus, GripVertical, Loader2, Play, Pause, Tag, Calendar, AlertTriangle } from "lucide-react";
import { formatDate, formatDuration } from "../../../lib/format";
import { toast } from "sonner";

type Status = "todo" | "in_progress" | "qa_testing" | "client_review" | "done";
type Priority = "low" | "normal" | "high" | "critical";

interface Task {
  id: string; project_id: string; title: string; description: string | null;
  status: Status; priority: Priority; due_date: string | null; tags: string[]; position: number;
}
interface Project { id: string; name: string; }

const STATUSES: { id: Status; label: string; tone: string }[] = [
  { id: "todo", label: "To Do", tone: "border-l-muted-foreground" },
  { id: "in_progress", label: "In Progress", tone: "border-l-chart-1" },
  { id: "qa_testing", label: "QA Testing", tone: "border-l-chart-3" },
  { id: "client_review", label: "Client Review", tone: "border-l-chart-4" },
  { id: "done", label: "Done", tone: "border-l-success" },
];

const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-chart-2/15 text-chart-2",
  high: "bg-warning/20 text-warning-foreground",
  critical: "bg-destructive/15 text-destructive",
};

function TasksContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get("project") || "all";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timerTaskId) return;
    const i = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [timerTaskId]);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: t, error: e1 }, { data: p }] = await Promise.all([
      supabase.from("tasks").select("*").order("position"),
      supabase.from("projects").select("id, name").order("name"),
    ]);
    if (e1) toast.error(e1.message);
    setTasks((t ?? []) as Task[]);
    setProjects((p ?? []) as Project[]);
    setLoading(false);
  }

  const filteredTasks = projectIdParam !== "all" ? tasks.filter((t) => t.project_id === projectIdParam) : tasks;

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const newStatus = e.over?.id as Status | undefined;
    if (!newStatus) return;
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === newStatus) return;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status: newStatus } : x)));
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) { toast.error(error.message); void load(); }
  }

  async function stopTimer() {
    if (!timerTaskId) return;
    const seconds = elapsed;
    const taskId = timerTaskId;
    setTimerTaskId(null);
    setElapsed(0);
    if (seconds < 5) return toast.info("Timer too short — discarded");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not signed in");
    const { error } = await supabase.from("time_logs").insert({
      task_id: taskId, user_id: user.id, duration_seconds: seconds,
      description: "Tracked via in-app timer",
    });
    if (error) toast.error(error.message);
    else toast.success(`Logged ${formatDuration(seconds)}`);
  }

  const activeTask = activeId ? filteredTasks.find((x) => x.id === activeId) : null;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Drag across columns to update status. Use the timer to log billable time.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={projectIdParam} onValueChange={(v) => router.push(`/tasks${v === "all" ? "" : `?project=${v}`}`)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <NewTaskSheet projects={projects} defaultProjectId={projectIdParam === "all" ? undefined : projectIdParam} onCreated={load} />
        </div>
      </div>

      {timerTaskId && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <div>
                <div className="text-xs text-muted-foreground">Tracking time on</div>
                <div className="font-medium text-sm">{tasks.find((t) => t.id === timerTaskId)?.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg tabular-nums">{formatDuration(elapsed)}</span>
              <Button size="sm" variant="destructive" onClick={stopTimer}><Pause className="h-4 w-4 mr-1" /> Stop & log</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {STATUSES.map((s) => (
              <StatusColumn
                key={s.id} status={s}
                tasks={filteredTasks.filter((t) => t.status === s.id)}
                projectName={projectName}
                timerTaskId={timerTaskId}
                onStartTimer={(id) => { setTimerTaskId(id); setElapsed(0); }}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging projectName={projectName(activeTask.project_id)} timerActive={false} onStartTimer={() => { }} /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <TasksContent />
    </Suspense>
  );
}

function StatusColumn({ status, tasks, projectName, timerTaskId, onStartTimer }: {
  status: { id: Status; label: string; tone: string }; tasks: Task[];
  projectName: (id: string) => string; timerTaskId: string | null;
  onStartTimer: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div ref={setNodeRef} className={`rounded-xl border bg-card/40 p-3 transition-colors ${isOver ? "bg-accent/40 ring-2 ring-primary/40" : ""}`}>
      <div className={`flex items-center justify-between border-l-4 pl-2 mb-3 ${status.tone}`}>
        <div className="text-sm font-semibold">{status.label}</div>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} projectName={projectName(t.project_id)}
            timerActive={timerTaskId === t.id} onStartTimer={() => onStartTimer(t.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, dragging, projectName, timerActive, onStartTimer }: {
  task: Task; dragging?: boolean; projectName: string;
  timerActive: boolean; onStartTimer: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  return (
    <Card ref={setNodeRef} style={style}
      className={`cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${isDragging ? "opacity-50" : ""} ${dragging ? "rotate-2 shadow-elegant" : ""}`}
      {...attributes} {...listeners}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm leading-tight">{task.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{projectName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-[10px] ${PRIORITY_TONE[task.priority]}`} variant="secondary">{task.priority}</Badge>
          {task.tags.slice(0, 3).map((t) => (
            <span key={t} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              <Tag className="h-2.5 w-2.5" />{t}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
          <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
            {overdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {formatDate(task.due_date)}
          </span>
          <Button size="sm" variant={timerActive ? "default" : "ghost"} className="h-6 px-2 text-[11px]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); if (!timerActive) onStartTimer(); }}>
            <Play className="h-3 w-3 mr-1" /> {timerActive ? "Tracking" : "Track"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewTaskSheet({ projects, defaultProjectId, onCreated }: {
  projects: Project[]; defaultProjectId?: string; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    title: "", description: "", project_id: defaultProjectId ?? "",
    status: "todo" as Status, priority: "normal" as Priority,
    due_date: "", tags: "",
  });
  useEffect(() => { if (defaultProjectId) setF((p) => ({ ...p, project_id: defaultProjectId })); }, [defaultProjectId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.project_id) return toast.error("Select a project");
    setSubmitting(true);
    const { error } = await supabase.from("tasks").insert({
      project_id: f.project_id, title: f.title,
      description: f.description || null,
      status: f.status, priority: f.priority,
      due_date: f.due_date || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setOpen(false);
    setF((p) => ({ ...p, title: "", description: "", tags: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New task</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>New task</SheetTitle><SheetDescription>Add work to a project board.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Fld>
          <Fld label="Project">
            <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
            <Fld label="Priority">
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "normal", "high", "critical"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Due date"><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Fld>
            <Fld label="Tags (comma sep)"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="Frontend, API" /></Fld>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create task"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
