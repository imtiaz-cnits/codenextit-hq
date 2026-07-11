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
import { Plus, Loader2, ArrowDownCircle } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import { TableSkeleton } from "../../../../components/loading-skeletons";

type IncomeType = "project" | "service" | "retainer" | "other";
interface Income {
  id: string; date: string; purpose: string; type: IncomeType;
  amount: number; currency: "BDT" | "USD"; comments: string | null;
  client_id: string | null;
}
interface Client { id: string; company_name: string; }

const TYPES: IncomeType[] = ["project", "service", "retainer", "other"];

export default function IncomePage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "project_manager"]);
  const [rows, setRows] = useState<Income[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: r, error }, { data: c }] = await Promise.all([
      supabase.from("income_entries").select("*").order("date", { ascending: false }),
      supabase.from("clients").select("id, company_name").eq("is_vault_folder", false),
    ]);
    if (error) toast.error(error.message);
    setRows((r ?? []) as Income[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income</h1>
          <p className="text-muted-foreground mt-1">All earnings logged across projects, services and retainers.</p>
        </div>
        {isAdmin && <NewIncomeSheet clients={clients} onCreated={load} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total entries" value={rows.length.toString()} />
        <Stat label="Total income (BDT)" value={formatCurrency(rows.filter(r => r.currency === "BDT").reduce((s, r) => s + Number(r.amount), 0), "BDT")} />
        <Stat label="Total income (USD)" value={formatCurrency(rows.filter(r => r.currency === "USD").reduce((s, r) => s + Number(r.amount), 0), "USD")} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ledger</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><ArrowDownCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />No income entries yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Purpose</TableHead>
                <TableHead>Type</TableHead><TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Comments</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.purpose}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{clientName(r.client_id)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(Number(r.amount), r.currency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{r.comments ?? "—"}</TableCell>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </CardContent></Card>
  );
}

function NewIncomeSheet({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    date: today, purpose: "", type: "project" as IncomeType,
    amount: "0", currency: "BDT" as "BDT" | "USD", comments: "", client_id: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("income_entries").insert({
      date: f.date, purpose: f.purpose, type: f.type,
      amount: Number(f.amount) || 0, currency: f.currency,
      comments: f.comments || null, client_id: f.client_id || null,
      recorded_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Income entry added");
    setOpen(false);
    setF((p) => ({ ...p, purpose: "", amount: "0", comments: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add income</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Add income</SheetTitle><SheetDescription>Log an income entry.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Fld>
            <Fld label="Type">
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as IncomeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Purpose"><Input required value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Acme Corp - Phase 2 milestone" /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Amount"><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Client (optional)">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Internal / not linked" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="Comments"><Textarea value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} rows={3} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add entry"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
