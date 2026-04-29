"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { useAuth } from "../../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Plus, Loader2, Banknote } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";

interface SalaryRow {
  id: string; date: string; purpose: string; amount: number;
  payouts: Record<string, number>; comments: string | null;
}
interface EmployeeRow {
  id: string;
  profile_id: string;
  profiles: { full_name: string } | null;
}
interface DisplayEmployee { id: string; name: string; }

export default function SalaryPage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "project_manager"]);
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [employees, setEmployees] = useState<DisplayEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: r, error }, { data: emp }] = await Promise.all([
      supabase.from("salary_sheet").select("*").order("date", { ascending: false }),
      supabase.from("employees").select("id, profile_id, profiles:profile_id(full_name)").order("created_at"),
    ]);
    if (error) toast.error(error.message);
    setRows((r ?? []) as SalaryRow[]);
    const empRows = (emp ?? []) as unknown as EmployeeRow[];
    setEmployees(empRows.map((e) => ({ id: e.id, name: e.profiles?.full_name ?? "—" })));
    setLoading(false);
  }

  const teamColumns = useMemo<DisplayEmployee[]>(() => {
    const seen = new Map<string, string>();
    employees.forEach((e) => seen.set(e.id, e.name));
    rows.forEach((r) => Object.keys(r.payouts || {}).forEach((id) => {
      if (!seen.has(id)) seen.set(id, "Former member");
    }));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [employees, rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salary Sheet</h1>
          <p className="text-muted-foreground mt-1">Per-payout breakdown across the team. Columns auto-sync to your Team list.</p>
        </div>
        {isAdmin && <NewSalarySheet employees={employees} onCreated={load} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payouts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><Banknote className="h-10 w-10 mx-auto mb-3 opacity-40" />No salary entries yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {teamColumns.map((e) => (
                  <TableHead key={e.id} className="text-right whitespace-nowrap">{e.name}</TableHead>
                ))}
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.purpose}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(Number(r.amount), "BDT")}</TableCell>
                    {teamColumns.map((e) => {
                      const v = Number(r.payouts?.[e.id] ?? 0);
                      return (
                        <TableCell key={e.id} className="text-right font-mono text-xs">
                          {v > 0 ? formatCurrency(v, "BDT") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
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

function NewSalarySheet({ employees, onCreated }: { employees: DisplayEmployee[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [purpose, setPurpose] = useState("Monthly payroll");
  const [comments, setComments] = useState("");
  const [payouts, setPayouts] = useState<Record<string, string>>({});

  function setPayout(id: string, v: string) {
    setPayouts((prev) => ({ ...prev, [id]: v }));
  }

  const total = Object.values(payouts).reduce((s, v) => s + (Number(v) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const cleaned: Record<string, number> = {};
    for (const [id, v] of Object.entries(payouts)) {
      const n = Number(v) || 0;
      if (n > 0) cleaned[id] = n;
    }
    const { error } = await supabase.from("salary_sheet").insert({
      date, purpose, amount: total, payouts: cleaned, comments: comments || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Salary sheet entry added");
    setOpen(false);
    setPayouts({});
    setComments("");
    onCreated();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New payroll entry</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>New salary entry</SheetTitle><SheetDescription>Set the payout per team member. Total auto-calculates.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Date"><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Fld>
            <Fld label="Purpose"><Input required value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Fld>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Per-member payout (BDT)</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto rounded-md border border-border p-3">
              {employees.length === 0 ? (
                <p className="text-xs text-muted-foreground">No employees yet — add team members first.</p>
              ) : employees.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">{e.name}</span>
                  <Input className="w-32" type="number" step="0.01" placeholder="0"
                    value={payouts[e.id] ?? ""} onChange={(ev) => setPayout(e.id, ev.target.value)} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Total: <span className="font-mono font-semibold">{formatCurrency(total, "BDT")}</span></p>
          </div>
          <Fld label="Comments"><Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting || total === 0}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save entry"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
