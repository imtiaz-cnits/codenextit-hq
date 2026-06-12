"use client";

import { useEffect, useState, useMemo } from "react";
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

interface Allowances {
  transport: number;
  medical: number;
  mobile: number;
  other: number;
}

interface SalarySheetRow {
  id: string;
  employee_id: string;
  month: string;
  base_salary: number;
  allowances: Allowances;
  deductions: number;
  net_payable: number;
  status: "draft" | "approved" | "paid";
  paid_at: string | null;
}

interface Employee { 
  id: string; 
  profile_id: string; 
  base_salary: number; 
  full_name: string;
  avatar_url?: string | null;
  status?: string;
}

export default function PayrollPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin") || hasRole("project_manager");
  
  const [payrolls, setPayrolls] = useState<SalarySheetRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    
    let payQuery = supabase.from("salary_sheets" as any).select("*").order("created_at", { ascending: false });
    let empQuery = supabase.from("employees").select("id, profile_id, base_salary, status, profiles(full_name, avatar_url)");
    
    if (!isSuperAdmin && user?.id) {
      // Find the employee ID for current user
      const { data: selfEmp } = await supabase.from("employees").select("id").eq("profile_id", user.id).maybeSingle();
      if (selfEmp) {
        payQuery = payQuery.eq("employee_id", selfEmp.id);
        empQuery = empQuery.eq("id", selfEmp.id);
      } else {
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

    const formattedEmp = (emp ?? [])
      .map((e: any) => ({
        id: e.id,
        profile_id: e.profile_id,
        base_salary: e.base_salary,
        status: e.status,
        full_name: e.profiles?.full_name || "Unknown",
        avatar_url: e.profiles?.avatar_url,
      }))
      .filter((e) => e.status !== "disabled");

    setEmployees(formattedEmp);
    setPayrolls((pay ?? []) as unknown as SalarySheetRow[]);
    setLoading(false);
  }

  const filtered = payrolls.filter((p) => p.month === month);
  const totalPaid = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + (p.net_payable || 0), 0);
  const totalDraft = filtered.filter((p) => p.status !== "paid").reduce((s, p) => s + (p.net_payable || 0), 0);

  async function generateForMonth() {
    const existing = new Set(payrolls.filter((p) => p.month === month).map((p) => p.employee_id));
    const toGen = employees.filter((e) => !existing.has(e.id));
    if (toGen.length === 0) return toast.info("All employees already in this month's run");

    const batch = toGen.map((e) => {
      const baseSalary = e.base_salary || 0;
      const allowances: Allowances = { transport: 0, medical: 0, mobile: 0, other: 0 };
      return {
        employee_id: e.id,
        month,
        base_salary: baseSalary,
        allowances,
        deductions: 0,
        net_payable: baseSalary,
        status: "draft" as const,
      };
    });

    const { error } = await supabase.from("salary_sheets" as any).insert(batch);
    if (error) return toast.error(error.message);

    toast.success(`Generated ${toGen.length} draft salary sheets`);
    void load();
  }

  async function setStatus(id: string, status: "paid" | "approved" | "draft") {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("salary_sheets" as any)
      .update({ 
        status, 
        paid_at: status === "paid" ? new Date().toISOString() : null,
        recorded_by: currentUser?.id || null
      })
      .eq("id", id);

    if (error) return toast.error(error.message);
    void load();
  }

  if (loading) return <TableSkeleton rows={8} cols={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Payroll</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin 
              ? "Generate monthly salary sheets, add allowances/deductions, and process payouts." 
              : "View your monthly salary slips and payment status."}
          </p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card/45 border-border/50"><CardContent className="p-5">
          <CardDescription className="text-xs uppercase tracking-wider">Paid this month</CardDescription>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold">{formatCurrency(totalPaid, "BDT")}</p>
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{filtered.filter((p) => p.status === "paid").length} payouts</Badge>
          </div>
        </CardContent></Card>
        <Card className="bg-card/45 border-border/50"><CardContent className="p-5">
          <CardDescription className="text-xs uppercase tracking-wider">Pending (draft / approved)</CardDescription>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold">{formatCurrency(totalDraft, "BDT")}</p>
            <Badge variant="secondary" className="bg-muted/50 border">{filtered.filter((p) => p.status !== "paid").length} sheets</Badge>
          </div>
        </CardContent></Card>
      </div>

      <Card className="bg-card/45 border-border/50">
        <CardHeader><CardTitle className="text-base">Salary Sheets · {month}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              {isSuperAdmin && <TableHead className="pl-6">Employee</TableHead>}
              <TableHead>Base Salary</TableHead>
              <TableHead>Allowances</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Payable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">No payslips for {month}.</TableCell></TableRow>}
              {filtered.map((p) => {
                const e = employees.find((x) => x.id === p.employee_id);
                const transport = Number(p.allowances?.transport || 0);
                const medical = Number(p.allowances?.medical || 0);
                const mobile = Number(p.allowances?.mobile || 0);
                const other = Number(p.allowances?.other || 0);
                const totalAllowances = transport + medical + mobile + other;

                return (
                  <TableRow key={p.id} className="hover:bg-muted/10">
                    {isSuperAdmin && (
                      <TableCell className="pl-6">
                        {e ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                              <AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm">{e.full_name}</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{formatCurrency(p.base_salary, "BDT")}</TableCell>
                    <TableCell className="font-mono text-xs text-emerald-500">
                      +{formatCurrency(totalAllowances, "BDT")}
                      {totalAllowances > 0 && (
                        <span className="text-[9px] text-muted-foreground block">
                          Trans: {transport} | Med: {medical}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-rose-500">-{formatCurrency(p.deductions, "BDT")}</TableCell>
                    <TableCell className="font-mono text-sm font-bold">{formatCurrency(p.net_payable, "BDT")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : p.status === "approved" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-slate-500/10 text-slate-500 border-slate-500/20"}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {isSuperAdmin && p.status !== "paid" ? (
                        <Button size="sm" onClick={() => { void setStatus(p.id, "paid"); toast.success("Payout registered and expense ledger entry generated!"); }} className="cursor-pointer">
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> Mark Paid
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => toast.info("PDF Payslip slip download — Phase 3")} className="cursor-pointer">
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
  const [employeeId, setEmployeeId] = useState("");
  const [baseSalary, setBaseSalary] = useState("0");
  const [transport, setTransport] = useState("0");
  const [medical, setMedical] = useState("0");
  const [mobile, setMobile] = useState("0");
  const [other, setOther] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (employees.length > 0 && !employeeId) {
      setEmployeeId(employees[0].id);
      setBaseSalary(String(employees[0].base_salary));
    }
  }, [employees]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return toast.error("Please select an employee");

    setBusy(true);

    const base = parseFloat(baseSalary) || 0;
    const transVal = parseFloat(transport) || 0;
    const medVal = parseFloat(medical) || 0;
    const mobVal = parseFloat(mobile) || 0;
    const othVal = parseFloat(other) || 0;
    const deduct = parseFloat(deductions) || 0;

    const allowances: Allowances = {
      transport: transVal,
      medical: medVal,
      mobile: mobVal,
      other: othVal
    };

    const netPayable = base + transVal + medVal + mobVal + othVal - deduct;

    const { error } = await supabase.from("salary_sheets" as any).insert({
      employee_id: employeeId,
      month,
      status: "draft",
      base_salary: base,
      allowances,
      deductions: deduct,
      net_payable: netPayable,
    });

    setBusy(false);
    if (error) return toast.error(error.message);
    
    toast.success("Payslip added successfully");
    setOpen(false);
    
    // Reset states
    setTransport("0");
    setMedical("0");
    setMobile("0");
    setOther("0");
    setDeductions("0");
    
    onDone();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="h-4 w-4 mr-1.5" /> Add Payslip
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Payslip · {month}</SheetTitle>
          <SheetDescription>Create manual salary sheet for an employee.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Employee">
            <Select value={employeeId} onValueChange={(v) => {
              const e = employees.find((x) => x.id === v);
              setEmployeeId(v);
              setBaseSalary(String(e?.base_salary ?? 0));
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          
          <Fld label="Base Salary (BDT)">
            <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
          </Fld>
          
          <h4 className="text-xs font-bold text-primary border-t pt-3 uppercase tracking-wider">Allowances</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Transport (BDT)">
              <Input type="number" value={transport} onChange={(e) => setTransport(e.target.value)} />
            </Fld>
            <Fld label="Medical (BDT)">
              <Input type="number" value={medical} onChange={(e) => setMedical(e.target.value)} />
            </Fld>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Mobile (BDT)">
              <Input type="number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Fld>
            <Fld label="Other Allowance (BDT)">
              <Input type="number" value={other} onChange={(e) => setOther(e.target.value)} />
            </Fld>
          </div>

          <h4 className="text-xs font-bold text-destructive border-t pt-3 uppercase tracking-wider">Deductions</h4>
          
          <Fld label="Deductions (BDT)">
            <Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="Loan repayments, advance salary etc." />
          </Fld>

          <SheetFooter className="border-t pt-4">
            <Button type="submit" className="w-full cursor-pointer" disabled={busy}>
              {busy ? "Saving..." : "Save payslip"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
