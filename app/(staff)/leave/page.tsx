"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useAuth } from "../../../lib/auth-context";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Plus, Check, X, Loader2, ChevronLeft, ChevronRight, RotateCcw, FileText, Download, Calendar as CalendarIcon } from "lucide-react";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import { initials, avatarColor, formatDate } from "../../../lib/format";
import { supabase } from "../../../integrations/supabase/client";
import { toast } from "sonner";
import { useMock } from "../../../lib/mock-store";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  startOfWeek, endOfWeek, isSameMonth, isWithinInterval, parseISO,
} from "date-fns";

type LeaveType = "sick" | "casual" | "annual" | "unpaid";
type LeaveStatus = "pending" | "approved" | "rejected";
interface Leave {
  id: string;
  employee_id: string;
  type: LeaveType;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: LeaveStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}
interface EmployeeRow {
  id: string;
  profile_id: string;
  designation: string | null;
  department: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

const LEAVE_TONE: Record<LeaveType, string> = {
  sick: "bg-destructive/15 text-destructive border-destructive/30",
  casual: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  annual: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  unpaid: "bg-muted text-muted-foreground border-border",
};

export default function LeavePage() {
  const { user, hasRole } = useAuth();
  const { addNotification, notifyAdmins } = useMock();
  const isSuperAdmin = hasRole("super_admin");
  
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // Report Filters
  const [reportRange, setReportRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const currentUserEmp = employees.find(e => e.profile_id === user?.id) || 
                         employees.find(e => e.full_name === user?.user_metadata?.full_name); // Fallback to name if email unavailable in local state

  useEffect(() => { void load(); }, [user]);
  async function load() {
    if (!user) return;
    setLoading(true);
    
    let leaveQuery = supabase.from("leave_requests").select("*").order("from_date", { ascending: false });
    let empQuery = supabase.from("employees").select("id, profile_id, email, designation, department") as any;
    
    if (!isSuperAdmin) {
      // Find the employee ID for current user to filter their own leaves
      const { data: selfEmp } = await supabase
        .from("employees")
        .select("id")
        .or(`profile_id.eq.${user?.id},email.eq.${user?.email}`)
        .maybeSingle();

      if (selfEmp) {
        leaveQuery = leaveQuery.eq("employee_id", selfEmp.id);
      }
    }

    const [{ data: l, error: le }, { data: e, error: ee }, { data: profs }] = await Promise.all([
      leaveQuery,
      empQuery,
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);
    if (le) toast.error(le.message);
    if (ee) toast.error(ee.message);
    const profData = (profs ?? []) as { id: string; full_name: string; avatar_url: string | null }[];
    const nameByProfile = new Map(profData.map((p) => [p.id, p.full_name]));
    const avatarByProfile = new Map(profData.map((p) => [p.id, p.avatar_url]));
    setLeaves((l ?? []) as Leave[]);
    
    type EmpRow = { id: string; profile_id: string; full_name: string; email: string; designation: string | null; department: string; avatar_url?: string | null };
    setEmployees(
      ((e ?? []) as any[]).map((r) => ({
        id: r.id,
        profile_id: r.profile_id,
        designation: r.designation,
        department: r.department,
        email: r.email,
        full_name: (r as any).full_name || nameByProfile.get(r.profile_id) || "Unknown",
        avatar_url: avatarByProfile.get(r.profile_id),
      })),
    );
    setLoading(false);
  }

  const employee = (id: string) => employees.find((e) => e.id === id);
  const counts = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
  };

  async function setStatus(id: string, status: LeaveStatus) {
    const { data: leave } = await supabase.from("leave_requests").select("employee_id").eq("id", id).maybeSingle();
    const { error } = await supabase.from("leave_requests").update({
      status, approved_at: status !== "pending" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);

    // Notify Employee
    if (leave && leave.employee_id) {
      const emp = employees.find(e => e.id === leave.employee_id);
      if (emp?.profile_id) {
        await addNotification(emp.profile_id, {
          title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          body: `Your leave request has been ${status}.`,
          type: status === "approved" ? "success" : "error"
        });
      }
    }

    toast.success(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated");
    void load();
  }

  const filteredReports = useMemo(() => {
    return leaves.filter((l) => l.from_date >= reportRange.from && l.from_date <= reportRange.to);
  }, [leaves, reportRange]);

  const exportCSV = () => {
    const headers = ["Employee", "Type", "From", "To", "Reason", "Status"];
    const rows = filteredReports.map(l => [
      employee(l.employee_id)?.full_name ?? "Unknown",
      l.type, l.from_date, l.to_date, l.reason ?? "", l.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `leave_report_${reportRange.from}_to_${reportRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Approve or reject team leave applications.</p>
        </div>
        <NewLeaveSheet 
          open={open} 
          onOpenChange={setOpen} 
          employees={employees} 
          onCreated={load} 
          isSuperAdmin={isSuperAdmin}
          currentEmpId={currentUserEmp?.id}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Pending" value={counts.pending} tone="warning" />
        <Stat label="Approved" value={counts.approved} tone="success" />
        <Stat label="Rejected" value={counts.rejected} tone="destructive" />
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">All requests</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : leaves.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">No leave requests yet.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Employee</TableHead><TableHead>Type</TableHead>
                    <TableHead>From</TableHead><TableHead>To</TableHead>
                    <TableHead>Reason</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {leaves.map((l) => {
                      const e = employee(l.employee_id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            {e ? (
                              <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                                <AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback>
                              </Avatar>
                                <div>
                                  <div className="font-medium text-sm">{e.full_name}</div>
                                  <div className="text-xs text-muted-foreground">{e.department}</div>
                                </div>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Unknown</span>}
                          </TableCell>
                          <TableCell><Badge variant="outline" className={`capitalize ${LEAVE_TONE[l.type]}`}>{l.type}</Badge></TableCell>
                          <TableCell className="text-sm">{formatDate(l.from_date)}</TableCell>
                          <TableCell className="text-sm">{formatDate(l.to_date)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{l.reason ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{l.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {isSuperAdmin && l.status === "pending" && (
                                <>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setStatus(l.id, "approved")} title="Approve">
                                    <Check className="h-4 w-4 text-success" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setStatus(l.id, "rejected")} title="Reject">
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                              {isSuperAdmin && l.status !== "pending" && (
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={() => setStatus(l.id, "pending")} title="Reset to Pending">
                                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {!isSuperAdmin && (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {l.status === 'pending' ? 'Awaiting' : 'Processed'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <LeaveCalendar leaves={leaves} employees={employees} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Leave Report</CardTitle>
                <p className="text-xs text-muted-foreground">Detailed summary and history</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-4">
                  <FlatDatePicker 
                    date={reportRange.from} 
                    onChange={d => setReportRange({...reportRange, from: d})} 
                    className="h-9 w-[180px]"
                  />
                  <span className="text-muted-foreground text-xs font-medium">to</span>
                  <FlatDatePicker 
                    date={reportRange.to} 
                    onChange={d => setReportRange({...reportRange, to: d})} 
                    className="h-9 w-[180px]"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={exportCSV} className="h-9"><Download className="h-3.5 w-3.5 mr-1" /> Excel</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <SummaryCard label="Total Days" value={filteredReports.length} icon={FileText} />
                <SummaryCard label="Approved" value={filteredReports.filter(r => r.status === 'approved').length} tone="success" />
                <SummaryCard label="Pending" value={filteredReports.filter(r => r.status === 'pending').length} tone="warning" />
                <SummaryCard label="Rejected" value={filteredReports.filter(r => r.status === 'rejected').length} tone="destructive" />
              </div>
              
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredReports.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium text-sm">{employee(l.employee_id)?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatDate(l.from_date)} - {formatDate(l.to_date)}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] uppercase ${LEAVE_TONE[l.type]}`}>{l.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.reason ?? "—"}</TableCell>
                      <TableCell><Badge variant={l.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-[10px]">{l.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {filteredReports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No data for selected range.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon?: any; tone?: string }) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'destructive' ? 'text-destructive' : 'text-primary';
  return (
    <div className="p-3 rounded-lg border bg-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between">
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/50" />}
      </div>
    </div>
  );
}

function LeaveCalendar({ leaves, employees }: { leaves: Leave[]; employees: EmployeeRow[] }) {
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);
  const employee = (id: string) => employees.find((e) => e.id === id);

  function leavesOn(d: Date) {
    return leaves.filter((l) => l.status !== "rejected" && isWithinInterval(d, { start: parseISO(l.from_date), end: parseISO(l.to_date) }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{format(cursor, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setCursor((c) => subMonths(c, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor((c) => addMonths(c, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-muted-foreground border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((d) => {
            const dayLeaves = leavesOn(d);
            const inMonth = isSameMonth(d, cursor);
            return (
              <div key={d.toISOString()} className={`min-h-[96px] border-b border-r p-1.5 ${inMonth ? "" : "bg-muted/30 text-muted-foreground"}`}>
                <div className="text-xs font-medium mb-1">{format(d, "d")}</div>
                <div className="space-y-0.5">
                  {dayLeaves.slice(0, 3).map((l) => {
                    const e = employee(l.employee_id);
                    return (
                      <div
                        key={l.id}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate ${LEAVE_TONE[l.type]} ${l.status === "pending" ? "opacity-60" : ""}`}
                        title={`${e?.full_name ?? "?"} · ${l.type} · ${l.status}`}
                      >
                        {e?.full_name?.split(" ")[0] ?? "?"} · {l.type}
                      </div>
                    );
                  })}
                  {dayLeaves.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">+{dayLeaves.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function NewLeaveSheet({
  open, onOpenChange, employees, onCreated, isSuperAdmin, currentEmpId
}: {
  open: boolean; onOpenChange: (v: boolean) => void; employees: EmployeeRow[]; onCreated: () => void;
  isSuperAdmin: boolean; currentEmpId?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    employee_id: "", type: "casual" as LeaveType,
    from_date: "", to_date: "", reason: "",
  });
  useEffect(() => {
    if (isSuperAdmin) {
      if (employees.length && !f.employee_id) setF((p) => ({ ...p, employee_id: employees[0].id }));
    } else if (currentEmpId) {
      setF((p) => ({ ...p, employee_id: currentEmpId }));
    }
  }, [employees, f.employee_id, isSuperAdmin, currentEmpId]);

    async function submit(e: React.FormEvent) {
      e.preventDefault();
      if (!f.employee_id) return toast.error("Select an employee");
      setSubmitting(true);
      const { error } = await supabase.from("leave_requests").insert([{
        employee_id: f.employee_id, type: f.type,
        from_date: f.from_date, to_date: f.to_date,
        reason: f.reason || null, status: "pending" as const,
      }]);
      setSubmitting(false);
      if (error) return toast.error(error.message);
      
      // Notify Admins
      const emp = employees.find(e => e.id === f.employee_id);
      await notifyAdmins({
        title: "New Leave Request",
        body: `${emp?.full_name || "An employee"} has requested a ${f.type} leave.`,
        type: "info"
      });

      toast.success("Leave request submitted");
      onOpenChange(false);
      setF((p) => ({ ...p, from_date: "", to_date: "", reason: "" }));
      onCreated();
    }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New request</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>New leave request</SheetTitle><SheetDescription>Submit on behalf of an employee.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Employee">
            <Select 
              value={f.employee_id} 
              onValueChange={(v) => setF({ ...f, employee_id: v })}
              disabled={!isSuperAdmin}
            >
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="Type">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as LeaveType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="From">
              <FlatDatePicker 
                date={f.from_date} 
                onChange={d => setF({...f, from_date: d})} 
              />
            </Fld>
            <Fld label="To">
              <FlatDatePicker 
                date={f.to_date} 
                onChange={d => setF({...f, to_date: d})} 
              />
            </Fld>
          </div>
          <Fld label="Reason"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={3} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "destructive" }) {
  const cls = { success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning-foreground", destructive: "bg-destructive/10 text-destructive" }[tone];
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-end gap-3 mt-1">
        <p className="text-3xl font-bold">{value}</p>
        <Badge variant="secondary" className={cls}>{tone}</Badge>
      </div>
    </CardContent></Card>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
