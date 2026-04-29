"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Plus, Check, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { initials, avatarColor, formatDate } from "../../../lib/format";
import { supabase } from "../../../integrations/supabase/client";
import { toast } from "sonner";
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
}

const LEAVE_TONE: Record<LeaveType, string> = {
  sick: "bg-destructive/15 text-destructive border-destructive/30",
  casual: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  annual: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  unpaid: "bg-muted text-muted-foreground border-border",
};

export default function LeavePage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: l, error: le }, { data: e, error: ee }, { data: profs }] = await Promise.all([
      supabase.from("leave_requests").select("*").order("from_date", { ascending: false }),
      supabase.from("employees").select("id, profile_id, designation, department"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (le) toast.error(le.message);
    if (ee) toast.error(ee.message);
    const nameByProfile = new Map(((profs ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
    setLeaves((l ?? []) as Leave[]);
    type EmpRow = { id: string; profile_id: string; designation: string | null; department: string };
    setEmployees(
      ((e ?? []) as EmpRow[]).map((r) => ({
        id: r.id,
        profile_id: r.profile_id,
        designation: r.designation,
        department: r.department,
        full_name: nameByProfile.get(r.profile_id) ?? "Unknown",
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
    const { error } = await supabase.from("leave_requests").update({
      status, approved_at: status !== "pending" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Approve or reject team leave applications.</p>
        </div>
        <NewLeaveSheet open={open} onOpenChange={setOpen} employees={employees} onCreated={load} />
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
                                <Avatar className="h-7 w-7"><AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback></Avatar>
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
                            {l.status === "pending" ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "approved")}><Check className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
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
      </Tabs>
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
  open, onOpenChange, employees, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; employees: EmployeeRow[]; onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    employee_id: "", type: "casual" as LeaveType,
    from_date: "", to_date: "", reason: "",
  });
  useEffect(() => {
    if (employees.length && !f.employee_id) setF((p) => ({ ...p, employee_id: employees[0].id }));
  }, [employees, f.employee_id]);

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
            <Select value={f.employee_id} onValueChange={(v) => setF({ ...f, employee_id: v })}>
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
            <Fld label="From"><Input required type="date" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} /></Fld>
            <Fld label="To"><Input required type="date" value={f.to_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} /></Fld>
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
