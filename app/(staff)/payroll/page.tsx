"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { DollarSign, Plus, Download, Loader2 } from "lucide-react";
import { formatCurrency, initials, avatarColor } from "../../../lib/format";
import { toast } from "sonner";
import { TableSkeleton } from "../../../components/loading-skeletons";

interface PayrollRow {
  id: string; employee_id: string; month: string;
  base: number; bonus: number; deduction: number; net: number | null;
  status: string; paid_at: string | null;
}
interface Employee { 
  id: string; 
  profile_id: string; 
  base_salary: number; 
  full_name: string;
  avatar_url?: string | null;
}

export default function PayrollPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    
    let payQuery = supabase.from("payroll").select("*").order("created_at", { ascending: false });
    let empQuery = supabase.from("employees").select("id, profile_id, base_salary, profiles(full_name, avatar_url)");
    
    if (!isSuperAdmin && user?.id) {
      // Find the employee ID for current user
      const { data: selfEmp } = await supabase.from("employees").select("id").eq("profile_id", user.id).maybeSingle();
      if (selfEmp) {
        payQuery = payQuery.eq("employee_id", selfEmp.id);
        empQuery = empQuery.eq("id", selfEmp.id);
      } else {
        // No employee record found for this user
        setPayrolls([]);
        setEmployees([]);
        setLoading(false);
        return;
      }
    }

    const [{ data: pay }, { data: emp }] = await Promise.all([
      payQuery,
      empQuery,
    ]);

    const formattedEmp = (emp ?? []).map((e: any) => ({
      id: e.id,
      profile_id: e.profile_id,
      base_salary: e.base_salary,
      full_name: e.profiles?.full_name || "Unknown",
      avatar_url: e.profiles?.avatar_url,
    }));

    setEmployees(formattedEmp);
    setPayrolls((pay ?? []) as unknown as PayrollRow[]);
    setLoading(false);
  }

  const filtered = payrolls.filter((p) => p.month === month);
  const totalPaid = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + (p.net || 0), 0);
  const totalDraft = filtered.filter((p) => p.status === "draft").reduce((s, p) => s + (p.net || 0), 0);

  async function generateForMonth() {
    const existing = new Set(payrolls.filter((p) => p.month === month).map((p) => p.employee_id));
    const toGen = employees.filter((e) => !existing.has(e.id));
    if (toGen.length === 0) return toast.info("All employees already in this month's run");

    const batch = toGen.map((e) => ({
      employee_id: e.id,
      month,
      base: e.base_salary,
      bonus: 0,
      deduction: 0,
      status: "draft" as const,
    }));

    const { error } = await supabase.from("payroll").insert(batch);
    if (error) return toast.error(error.message);

    toast.success(`Generated ${toGen.length} draft payslips`);
    void load();
  }

  async function setStatus(id: string, status: "paid" | "draft") {
    const { error } = await supabase
      .from("payroll")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  if (loading) return <TableSkeleton rows={8} cols={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">{isSuperAdmin ? "Generate payslips and mark them paid." : "View your monthly salary slips and status."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[170px]" />
          {isSuperAdmin && (
            <>
              <Button variant="outline" onClick={generateForMonth}>Generate run</Button>
              <NewPayslipSheet month={month} employees={employees} onDone={load} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <CardDescription className="text-xs uppercase tracking-wider">Paid this month</CardDescription>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold">{formatCurrency(totalPaid, "BDT")}</p>
            <Badge className="bg-success text-success-foreground">{filtered.filter((p) => p.status === "paid").length} payslips</Badge>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <CardDescription className="text-xs uppercase tracking-wider">Pending (draft)</CardDescription>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold">{formatCurrency(totalDraft, "BDT")}</p>
            <Badge variant="secondary">{filtered.filter((p) => p.status === "draft").length} drafts</Badge>
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payslips · {month}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              {isSuperAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Base</TableHead><TableHead>Bonus</TableHead>
              <TableHead>Deduction</TableHead><TableHead>Net</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">No payslips for {month}.</TableCell></TableRow>}
              {filtered.map((p) => {
                const e = employees.find((x) => x.id === p.employee_id);
                const net = (p.base || 0) + (p.bonus || 0) - (p.deduction || 0);
                return (
                  <TableRow key={p.id}>
                    {isSuperAdmin && (
                      <TableCell>
                        {e ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                              <AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{e.full_name}</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{formatCurrency(p.base, "BDT")}</TableCell>
                    <TableCell className="font-mono text-xs text-success">+{formatCurrency(p.bonus, "BDT")}</TableCell>
                    <TableCell className="font-mono text-xs text-destructive">-{formatCurrency(p.deduction, "BDT")}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{formatCurrency(net, "BDT")}</TableCell>
                    <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"} className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isSuperAdmin && p.status === "draft" ? (
                        <Button size="sm" onClick={() => { void setStatus(p.id, "paid"); toast.success("Marked as paid"); }}>
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> Mark paid
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => toast.info("Payslip download — Phase 3 (PDF generation)")}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Slip
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewPayslipSheet({ month, employees, onDone }: { month: string; employees: Employee[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    employee_id: "", base: "0", bonus: "0", deduction: "0",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (employees.length > 0 && !f.employee_id) {
      setF(prev => ({ ...prev, employee_id: employees[0].id, base: String(employees[0].base_salary) }));
    }
  }, [employees]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("payroll").insert({
      employee_id: f.employee_id,
      month,
      status: "draft",
      base: Number(f.base) || 0,
      bonus: Number(f.bonus) || 0,
      deduction: Number(f.deduction) || 0,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payslip added");
    setOpen(false);
    onDone();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add payslip</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Add payslip · {month}</SheetTitle><SheetDescription>Manual entry for one employee.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Employee">
            <Select value={f.employee_id} onValueChange={(v) => {
              const e = employees.find((x) => x.id === v);
              setF({ ...f, employee_id: v, base: String(e?.base_salary ?? 0) });
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="Base"><Input type="number" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Bonus"><Input type="number" value={f.bonus} onChange={(e) => setF({ ...f, bonus: e.target.value })} /></Fld>
            <Fld label="Deduction"><Input type="number" value={f.deduction} onChange={(e) => setF({ ...f, deduction: e.target.value })} /></Fld>
          </div>
          <SheetFooter><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save payslip"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
