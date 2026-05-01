"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { useAuth } from "../../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Badge } from "../../../../components/ui/badge";
import { Plus, Loader2, ArrowUpCircle, Check, X } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";

type ExpenseType = "office" | "software" | "travel" | "salary" | "utility" | "marketing" | "other";
type Approval = "pending" | "approved" | "rejected";
interface ExpenseRow {
  id: string; date: string; purpose: string; type: ExpenseType;
  amount: number; currency: "BDT" | "USD"; comments: string | null;
  vendor: string | null; approval: Approval; recorded_by: string | null;
}

const TYPES: ExpenseType[] = ["office", "software", "travel", "salary", "utility", "marketing", "other"];
const APPROVAL_TONE: Record<Approval, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

export default function ExpensePage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "project_manager"]);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Approval>("all");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("expense_entries").select("*").order("date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as ExpenseRow[]);
    setLoading(false);
  }

  async function setApproval(id: string, approval: Approval) {
    const { data: { user } } = await supabase.auth.getUser();
    const patch = approval === "approved"
      ? { approval, approved_by: user?.id ?? null, approved_at: new Date().toISOString() }
      : { approval, approved_by: null, approved_at: null };
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, approval } : r));
    const { error } = await supabase.from("expense_entries").update(patch).eq("id", id);
    if (error) { toast.error(error.message); void load(); }
    else toast.success(`Expense ${approval}`);
  }

  const visible = filter === "all" ? rows : rows.filter((r) => r.approval === filter);
  const counts: Record<"all" | Approval, number> = {
    all: rows.length,
    pending: rows.filter((r) => r.approval === "pending").length,
    approved: rows.filter((r) => r.approval === "approved").length,
    rejected: rows.filter((r) => r.approval === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense</h1>
          <p className="text-muted-foreground mt-1">
            Anyone on staff can submit. {isAdmin ? "You can approve or decline below." : "Admin approval is required before entries are finalised."}
          </p>
        </div>
        <NewExpenseSheet onCreated={load} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "pending", "approved", "rejected"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>
            <div className="text-xs uppercase tracking-wider opacity-80 capitalize">{k}</div>
            <div className="text-xl font-bold">{counts[k]}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ledger</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><ArrowUpCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />Nothing here.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Purpose</TableHead>
                <TableHead>Type</TableHead><TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {r.purpose}
                      {r.comments && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.comments}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.vendor ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(Number(r.amount), r.currency)}</TableCell>
                    <TableCell><Badge variant="secondary" className={APPROVAL_TONE[r.approval]}>{r.approval}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isAdmin && r.approval !== "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => setApproval(r.id, "approved")} className="text-success hover:text-success">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isAdmin && r.approval !== "rejected" && (
                        <Button size="sm" variant="ghost" onClick={() => setApproval(r.id, "rejected")} className="text-destructive hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewExpenseSheet({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = toLocalDateString();
  const [f, setF] = useState({
    date: today, purpose: "", type: "office" as ExpenseType,
    amount: "0", currency: "BDT" as "BDT" | "USD", vendor: "", comments: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("expense_entries").insert({
      date: f.date, purpose: f.purpose, type: f.type,
      amount: Number(f.amount) || 0, currency: f.currency,
      vendor: f.vendor || null, comments: f.comments || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Expense submitted (pending approval)");
    setOpen(false);
    setF((p) => ({ ...p, purpose: "", amount: "0", vendor: "", comments: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add expense</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Submit expense</SheetTitle><SheetDescription>Stays in pending state until an admin approves.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Fld>
            <Fld label="Type">
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as ExpenseType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Purpose"><Input required value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Amount"><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Vendor"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Fld>
          <Fld label="Comments"><Textarea value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} rows={3} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
