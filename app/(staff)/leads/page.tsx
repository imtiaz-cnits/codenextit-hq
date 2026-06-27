"use client";

import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { supabase } from "../../../integrations/supabase/client";
import { formatCurrency } from "../../../lib/format";
import { Plus, GripVertical, Mail, Phone, Building2, Loader2, TrendingUp, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { KanbanSkeleton } from "../../../components/loading-skeletons";

type LeadStage = "new_inquiry" | "meeting_scheduled" | "proposal_sent" | "negotiation" | "won" | "lost";
interface Lead {
  id: string;
  title: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  estimated_value: number;
  currency: "BDT" | "USD";
  position: number;
  notes: string | null;
}

const STAGES: { id: LeadStage; label: string; tone: string }[] = [
  { id: "new_inquiry", label: "New Inquiry", tone: "border-l-chart-1" },
  { id: "meeting_scheduled", label: "Meeting Scheduled", tone: "border-l-chart-2" },
  { id: "proposal_sent", label: "Proposal Sent", tone: "border-l-chart-3" },
  { id: "negotiation", label: "Negotiation", tone: "border-l-chart-4" },
  { id: "won", label: "Won", tone: "border-l-success" },
  { id: "lost", label: "Lost", tone: "border-l-destructive" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => { void loadLeads(); }, []);
  async function loadLeads() {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").order("position");
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = String(e.active.id);
    const newStage = e.over?.id as LeadStage | undefined;
    if (!newStage) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
    if (error) {
      toast.error("Failed to move: " + error.message);
      void loadLeads();
    } else {
      toast.success(`Moved to ${STAGES.find((s) => s.id === newStage)?.label}`);
    }
  }

  const totalValueBDT = leads.filter((l) => l.currency === "BDT" && l.stage !== "lost").reduce((s, l) => s + Number(l.estimated_value), 0);
  const totalValueUSD = leads.filter((l) => l.currency === "USD" && l.stage !== "lost").reduce((s, l) => s + Number(l.estimated_value), 0);
  const wonCount = leads.filter((l) => l.stage === "won").length;

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads Pipeline</h1>
          <p className="text-muted-foreground mt-1">Drag leads across stages. Changes persist instantly.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Pipeline value</div>
            <div className="font-semibold">{formatCurrency(totalValueBDT, "BDT")} · {formatCurrency(totalValueUSD, "USD")}</div>
          </div>
          <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" /> {wonCount} won</Badge>
          <NewLeadSheet open={open} onOpenChange={setOpen} onCreated={loadLeads} />
        </div>
      </div>

      {loading ? (
        <KanbanSkeleton columns={6} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {STAGES.map((s) => (
              <StageColumn key={s.id} stage={s} leads={leads.filter((l) => l.stage === s.id)} onOpen={setDetailLead} />
            ))}
          </div>
          <DragOverlay>{activeLead ? <LeadCard lead={activeLead} dragging /> : null}</DragOverlay>
        </DndContext>
      )}

      <LeadDetailDialog lead={detailLead} onClose={() => setDetailLead(null)} onChanged={loadLeads} />
    </div>
  );
}

function StageColumn({ stage, leads, onOpen }: { stage: { id: LeadStage; label: string; tone: string }; leads: Lead[]; onOpen: (l: Lead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = leads.reduce((s, l) => s + Number(l.estimated_value), 0);
  return (
    <div ref={setNodeRef} className={`rounded-xl border bg-card/40 p-3 transition-colors ${isOver ? "bg-accent/40 ring-2 ring-primary/40" : ""}`}>
      <div className={`flex items-center justify-between border-l-4 pl-2 mb-3 ${stage.tone}`}>
        <div>
          <div className="text-sm font-semibold">{stage.label}</div>
          <div className="text-xs text-muted-foreground">{leads.length} leads</div>
        </div>
        {total > 0 && <div className="text-xs font-medium text-muted-foreground">{formatCurrency(total, leads[0]?.currency ?? "BDT")}</div>}
      </div>
      <div className="space-y-2 min-h-[100px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {leads.map((l) => <LeadCard key={l.id} lead={l} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function LeadCard({ lead, dragging, onOpen }: { lead: Lead; dragging?: boolean; onOpen?: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${isDragging ? "opacity-50" : ""} ${dragging ? "rotate-2 shadow-elegant" : ""}`}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onOpen?.(lead)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm leading-tight">{lead.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3" /> {lead.company_name}
            </div>
          </div>
          {onOpen && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onOpen(lead); }}
              className="text-[10px] font-semibold text-primary hover:underline"
            >
              Open
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-mono">{formatCurrency(Number(lead.estimated_value), lead.currency)}</Badge>
          {lead.source && <span className="text-[10px] text-muted-foreground">{lead.source}</span>}
        </div>
        {(lead.email || lead.phone) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t pt-2">
            {lead.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{lead.email}</span>}
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{lead.phone}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadDetailDialog({ lead, onClose, onChanged }: { lead: Lead | null; onClose: () => void; onChanged: () => void }) {
  const [draft, setDraft] = useState<Lead | null>(lead);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(lead); }, [lead]);
  if (!draft) return null;

  async function save() {
    if (!draft) return;
    setBusy(true);
    const { error } = await supabase.from("leads").update({
      title: draft.title, company_name: draft.company_name, contact_person: draft.contact_person,
      email: draft.email, phone: draft.phone, source: draft.source, stage: draft.stage,
      estimated_value: Number(draft.estimated_value) || 0, currency: draft.currency, notes: draft.notes,
    }).eq("id", draft.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lead updated");
    onChanged();
    onClose();
  }
  async function remove() {
    if (!draft || !confirm("Delete this lead permanently?")) return;
    setBusy(true);
    const { error } = await supabase.from("leads").delete().eq("id", draft.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lead deleted");
    onChanged();
    onClose();
  }
  async function convert() {
    if (!draft) return;
    setBusy(true);
    const { error } = await supabase.from("clients").insert({
      company_name: draft.company_name,
      contact_person: draft.contact_person,
      email: draft.email,
      phone: draft.phone,
      currency: draft.currency,
      notes: draft.notes,
    });
    if (!error) {
      await supabase.from("leads").update({ stage: "won" }).eq("id", draft.id);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Converted to client");
    onChanged();
    onClose();
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lead details</DialogTitle>
          <DialogDescription>Edit the lead, convert it to a client, or remove it.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Company"><Input value={draft.company_name} onChange={(e) => setDraft({ ...draft, company_name: e.target.value })} /></Field>
          <Field label="Contact person"><Input value={draft.contact_person ?? ""} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} /></Field>
          <Field label="Source"><Input value={draft.source ?? ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
          <Field label="Estimated value"><Input type="number" value={String(draft.estimated_value)} onChange={(e) => setDraft({ ...draft, estimated_value: Number(e.target.value) })} /></Field>
          <Field label="Currency">
            <Select value={draft.currency} onValueChange={(v) => setDraft({ ...draft, currency: v as "BDT" | "USD" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={draft.stage} onValueChange={(v) => setDraft({ ...draft, stage: v as LeadStage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={convert} disabled={busy}><UserPlus className="h-4 w-4 mr-1.5" /> Convert to client</Button>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLeadSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", company_name: "", contact_person: "", email: "", phone: "",
    source: "", stage: "new_inquiry" as LeadStage, estimated_value: "0",
    currency: "BDT" as "BDT" | "USD", notes: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("leads").insert({
      ...form,
      estimated_value: Number(form.estimated_value) || 0,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Lead created");
    onOpenChange(false);
    setForm((f) => ({ ...f, title: "", company_name: "", contact_person: "", email: "", phone: "", estimated_value: "0", notes: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1.5" /> New lead</Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col h-full p-0 w-full sm:max-w-lg">
        <div className="py-3 px-6 border-b border-border/40 shrink-0">
          <SheetHeader>
            <SheetTitle>New lead</SheetTitle>
            <SheetDescription>Capture a fresh opportunity in your pipeline.</SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. E-commerce rebuild" /></Field>
            <Field label="Company"><Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
            <Field label="Contact person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estimated value"><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></Field>
              <Field label="Currency">
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as "BDT" | "USD" })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="BDT" className="cursor-pointer">BDT</SelectItem><SelectItem value="USD" className="cursor-pointer">USD</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stage">
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as LeadStage })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id} className="cursor-pointer">{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Source"><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, LinkedIn..." /></Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></Field>
          </div>

          <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
            <SheetFooter className="mt-0">
              <Button type="submit" disabled={submitting} className="w-full cursor-pointer">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : "Create lead"}</Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
