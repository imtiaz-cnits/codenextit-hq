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
import { Plus, Loader2, PiggyBank } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";

interface Investment {
  id: string; date: string; purpose: string;
  amount: number; currency: "BDT" | "USD";
  investor: string | null; comments: string | null;
}

export default function InvestmentPage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "project_manager"]);
  const [rows, setRows] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("investments").select("*").order("date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Investment[]);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment</h1>
          <p className="text-muted-foreground mt-1">Capital injections and reinvestments tracked over time.</p>
        </div>
        {isAdmin && <NewInvestmentSheet onCreated={load} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Investments ledger</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-40" />No investments recorded yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Purposes</TableHead>
                <TableHead>Investor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.purpose}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.investor ?? "—"}</TableCell>
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

function NewInvestmentSheet({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    date: today, purpose: "", amount: "0",
    currency: "BDT" as "BDT" | "USD", investor: "", comments: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("investments").insert({
      date: f.date, purpose: f.purpose,
      amount: Number(f.amount) || 0, currency: f.currency,
      investor: f.investor || null, comments: f.comments || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Investment recorded");
    setOpen(false);
    setF((p) => ({ ...p, purpose: "", amount: "0", investor: "", comments: "" }));
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add investment</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Record investment</SheetTitle><SheetDescription>Capital coming into the business.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Fld>
            <Fld label="Investor"><Input value={f.investor} onChange={(e) => setF({ ...f, investor: e.target.value })} /></Fld>
          </div>
          <Fld label="Purposes"><Input required value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Amount"><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Comments"><Textarea value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} rows={3} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
