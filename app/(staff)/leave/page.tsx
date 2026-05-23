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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Plus, Check, X, Loader2, ChevronLeft, ChevronRight, RotateCcw, FileText, Download, Calendar as CalendarIcon, Eye, Trash2 } from "lucide-react";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import { FlatTimePicker } from "../../../components/ui/flat-time-picker";
import { initials, avatarColor, formatDate } from "../../../lib/format";
import { supabase } from "../../../integrations/supabase/client";
import { toast } from "sonner";
import { useMock } from "../../../lib/mock-store";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  startOfWeek, endOfWeek, isSameMonth, isWithinInterval, parseISO, isToday,
} from "date-fns";
import { TableSkeleton } from "../../../components/loading-skeletons";
import { cn } from "../../../lib/utils";

type LeaveType = "sick" | "casual" | "annual" | "unpaid";
type LeaveStatus = "pending" | "approved" | "rejected";
type HalfDayPeriod = "first_half" | "second_half";
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
  is_half_day?: boolean | null;
  half_day_period?: HalfDayPeriod | null;
  start_time?: string | null;
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

// Format 24h "HH:MM" or "13:30" to 12h "1:30 PM"
function format12h(t?: string | null): string {
  if (!t) return "";
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = parseInt(m[1]);
  const min = m[2];
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

export default function LeavePage() {
  const { user, hasRole } = useAuth();
  const { addNotification, notifyAdmins } = useMock();
  const isSuperAdmin = hasRole("super_admin");

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);

  // Report Filters
  const [reportRange, setReportRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const currentUserEmp = employees.find(e => e.profile_id === user?.id) ||
    employees.find(e => e.email?.toLowerCase() === user?.email?.toLowerCase()) ||
    employees.find(e => e.full_name === user?.user_metadata?.full_name); // Fallback to name if email unavailable in local state

  useEffect(() => { void load(); }, [user]);
  async function load() {
    if (!user) return;
    setLoading(true);

    let leaveQuery = supabase.from("leave_requests").select("*").order("from_date", { ascending: false });
    let empQuery = supabase.from("employees").select("id, profile_id, email, designation, department") as any;

    let userEmpId: string | null = null;
    try {
      const { data: selfEmp } = await supabase
        .from("employees")
        .select("id, profile_id")
        .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (selfEmp) {
        userEmpId = selfEmp.id;
        if (selfEmp.profile_id !== user.id) {
          await supabase
            .from("employees")
            .update({ profile_id: user.id })
            .eq("id", selfEmp.id);
        }
      }
    } catch (err) {
      console.error("Self-healing profile sync error:", err);
    }

    if (!isSuperAdmin && userEmpId) {
      leaveQuery = leaveQuery.eq("employee_id", userEmpId);
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

  async function deleteLeave(id: string) {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    const { error } = await supabase.from("leave_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Leave request deleted successfully");
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

      <Tabs defaultValue={isSuperAdmin ? "staff" : "list"}>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className="bg-muted/50 p-1 h-auto rounded-xl inline-flex w-auto min-w-max border border-border/50">
            {isSuperAdmin && <TabsTrigger value="staff" className="rounded-lg px-4 py-[8px] data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer">Staff Requests</TabsTrigger>}
            <TabsTrigger value="list" className="rounded-lg px-4 py-[8px] data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer">My Requests</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg px-4 py-[8px] data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer">Calendar</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg px-4 py-[8px] data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-4">
          <LeaveTable
            leaves={isSuperAdmin ? leaves.filter(l => l.employee_id === currentUserEmp?.id) : leaves}
            loading={loading}
            isSuperAdmin={isSuperAdmin}
            onView={setSelectedLeave}
            onAction={setStatus}
            onDelete={deleteLeave}
            employee={employee}
          />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="staff" className="mt-4">
            <LeaveTable
              leaves={leaves.filter(l => l.employee_id !== currentUserEmp?.id)}
              loading={loading}
              isSuperAdmin={isSuperAdmin}
              onView={setSelectedLeave}
              onAction={setStatus}
              onDelete={deleteLeave}
              employee={employee}
              showEmployeeInfo={true}
            />
          </TabsContent>
        )}

        <TabsContent value="calendar" className="mt-4">
          <LeaveCalendar leaves={leaves} employees={employees} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b bg-muted/5">
              <div>
                <CardTitle className="text-lg font-bold">Leave Report</CardTitle>
                <p className="text-xs text-muted-foreground">Detailed summary and history</p>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center justify-center gap-3 w-full sm:w-auto">
                  <FlatDatePicker
                    date={reportRange.from}
                    onChange={d => setReportRange({ ...reportRange, from: d })}
                    className="h-9 w-full sm:w-[155px]"
                  />
                  <span className="text-muted-foreground text-[10px] font-bold uppercase min-w-[20px] text-center">to</span>
                  <FlatDatePicker
                    date={reportRange.to}
                    onChange={d => setReportRange({ ...reportRange, to: d })}
                    className="h-9 w-full sm:w-[155px]"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={exportCSV} className="h-9 w-full lg:w-auto shadow-sm cursor-pointer shrink-0">
                  <Download className="h-3.5 w-3.5 mr-1" /> Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <SummaryCard label="Total Days" value={filteredReports.length} icon={FileText} />
                <SummaryCard label="Approved" value={filteredReports.filter(r => r.status === 'approved').length} tone="success" />
                <SummaryCard label="Pending" value={filteredReports.filter(r => r.status === 'pending').length} tone="warning" />
                <SummaryCard label="Rejected" value={filteredReports.filter(r => r.status === 'rejected').length} tone="destructive" />
              </div>

              <div className="hidden md:block rounded-xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Duration</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Reason</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredReports.map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/5">
                        <TableCell className="font-medium text-sm">{employee(l.employee_id)?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-xs font-semibold">{formatDate(l.from_date)} - {formatDate(l.to_date)}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] uppercase font-bold ${LEAVE_TONE[l.type]}`}>{l.type}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.reason ?? "—"}</TableCell>
                        <TableCell><Badge variant={l.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-[10px] font-bold">{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {filteredReports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm italic">No data for selected range.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Report Cards */}
              <div className="md:hidden space-y-3">
                {filteredReports.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground italic text-sm bg-muted/5 rounded-xl border border-dashed">
                    No data for selected range.
                  </div>
                ) : (
                  filteredReports.map((l) => (
                    <div key={l.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">{employee(l.employee_id)?.full_name ?? "—"}</div>
                        <Badge variant={l.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-[10px] font-bold">{l.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-y border-dashed">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Duration</p>
                          <p className="font-semibold">{formatDate(l.from_date)} - {formatDate(l.to_date)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${LEAVE_TONE[l.type]}`}>{l.type}</Badge>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Reason</p>
                        <p className="text-xs text-muted-foreground italic line-clamp-2">"{l.reason || "No reason"}"</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LeaveDetailsDialog
        leave={selectedLeave}
        onClose={() => setSelectedLeave(null)}
        employee={selectedLeave ? employee(selectedLeave.employee_id) : undefined}
        onAction={setStatus}
        onDelete={deleteLeave}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}

function LeaveTable({
  leaves, loading, isSuperAdmin, onView, onAction, onDelete, employee, showEmployeeInfo = true
}: {
  leaves: Leave[]; loading: boolean; isSuperAdmin: boolean;
  onView: (l: Leave) => void; onAction: (id: string, s: LeaveStatus) => void;
  onDelete?: (id: string) => void;
  employee: (id: string) => EmployeeRow | undefined;
  showEmployeeInfo?: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{showEmployeeInfo ? "Staff requests" : "My requests"}</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : leaves.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No leave requests yet.</div>
        ) : (
          <>
            <div className="hidden md:block rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50"><TableRow>
                  {showEmployeeInfo && <TableHead className="font-bold">Employee</TableHead>}
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">From</TableHead><TableHead className="font-bold">To</TableHead>
                  <TableHead className="font-bold">Reason</TableHead><TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {leaves.map((l) => {
                    const e = employee(l.employee_id);
                    return (
                      <TableRow key={l.id} className="hover:bg-muted/5">
                        {showEmployeeInfo && (
                          <TableCell>
                            {e ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 border shadow-sm">
                                  {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                                  <AvatarFallback className={cn("text-[10px] text-white font-bold", avatarColor(e.full_name))}>{initials(e.full_name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-bold text-sm">{e.full_name}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{e.department}</div>
                                </div>
                              </div>
                            ) : <span className="text-xs text-muted-foreground italic">Unknown</span>}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`capitalize font-bold text-[10px] ${LEAVE_TONE[l.type]}`}>{l.type}</Badge>
                            {l.is_half_day && (
                              <Badge variant="outline" className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                ½ Day
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{formatDate(l.from_date)}</TableCell>
                        <TableCell className="text-sm font-semibold">
                          {l.is_half_day ? (
                            <span className="text-[11px] text-muted-foreground italic">
                              {l.half_day_period === "first_half" ? "Morning" : "Afternoon"}
                              {l.start_time && ` · ${format12h(l.start_time)}`}
                            </span>
                          ) : (
                            formatDate(l.to_date)
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.reason ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-[10px] font-bold">{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary cursor-pointer" onClick={() => onView(l)} title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isSuperAdmin && l.status === "pending" && (
                              <>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success cursor-pointer" onClick={() => onAction(l.id, "approved")} title="Approve">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive cursor-pointer" onClick={() => onAction(l.id, "rejected")} title="Reject">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isSuperAdmin && l.status !== "pending" && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted cursor-pointer" onClick={() => onAction(l.id, "pending")} title="Reset to Pending">
                                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {isSuperAdmin && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive cursor-pointer hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete?.(l.id)} title="Delete Request">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden space-y-3">
              {leaves.map((l) => {
                const e = employee(l.employee_id);
                return (
                  <div key={l.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border shadow-sm">
                          {e?.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                          <AvatarFallback className={cn("text-[10px] text-white font-bold", avatarColor(e?.full_name || "?"))}>{initials(e?.full_name || "?")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-sm">{e?.full_name || "Unknown"}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{e?.department || "N/A"}</div>
                        </div>
                      </div>
                      <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-[10px] font-bold">{l.status}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-dashed">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Duration</p>
                        {l.is_half_day ? (
                          <div>
                            <p className="text-xs font-semibold">{formatDate(l.from_date)}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                              ½ Day · {l.half_day_period === "first_half" ? "Morning" : "Afternoon"}
                              {l.start_time && ` (${format12h(l.start_time)})`}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold">{formatDate(l.from_date)} - {formatDate(l.to_date)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Type</p>
                        <Badge variant="outline" className={`capitalize font-bold text-[10px] ${LEAVE_TONE[l.type]}`}>{l.type}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex-1 mr-4">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Reason</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 italic">"{l.reason || "No reason"}"</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-primary border-primary/20 cursor-pointer" onClick={() => onView(l)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {isSuperAdmin && l.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-success border-success/20 cursor-pointer" onClick={() => onAction(l.id, "approved")}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive/20 cursor-pointer" onClick={() => onAction(l.id, "rejected")}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {isSuperAdmin && (
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive/20 cursor-pointer hover:bg-destructive/10" onClick={() => onDelete?.(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveDetailsDialog({
  leave, onClose, employee, onAction, onDelete, isSuperAdmin
}: {
  leave: Leave | null; onClose: () => void;
  employee?: EmployeeRow;
  onAction: (id: string, s: LeaveStatus) => void;
  onDelete?: (id: string) => void;
  isSuperAdmin: boolean;
}) {
  if (!leave) return null;

  return (
    <Dialog open={!!leave} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[550px] rounded-[1.5rem] p-5 sm:p-6 gap-4 border-none shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold text-center">Leave Application Details</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Submitted on {formatDate(leave.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-muted-foreground/5">
            <Avatar className="h-10 w-10 border shadow-sm shrink-0">
              {employee?.avatar_url && <AvatarImage src={employee.avatar_url} className="object-cover" />}
              <AvatarFallback className={cn("text-xs font-bold text-white", avatarColor(employee?.full_name || "?"))}>{initials(employee?.full_name || "?")}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{employee?.full_name || "Unknown Employee"}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{employee?.department || "—"}</div>
            </div>
            <Badge className="capitalize font-bold text-[10px] shrink-0" variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}>
              {leave.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 px-1">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Leave Type</p>
              <Badge variant="outline" className={`capitalize font-bold px-2 py-0.5 rounded-full text-[10px] ${LEAVE_TONE[leave.type]}`}>{leave.type}</Badge>
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Duration</p>
              {leave.is_half_day ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-primary break-words">{formatDate(leave.from_date)}</p>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Half Day · {leave.half_day_period === "first_half" ? "Morning" : "Afternoon"}
                    {leave.start_time && ` (from ${format12h(leave.start_time)})`}
                  </p>
                </div>
              ) : (
                <p className="text-xs font-bold text-primary break-words">{formatDate(leave.from_date)} - {formatDate(leave.to_date)}</p>
              )}
            </div>
          </div>

          {leave.reason && (
            <div className="space-y-1 px-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Reason</p>
              <div className="p-2.5 border rounded-xl bg-muted/20 text-xs leading-relaxed italic text-muted-foreground border-dashed break-words">
                "{leave.reason}"
              </div>
            </div>
          )}

          {leave.approved_at && (
            <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground italic text-center">
              Processed at {formatDate(leave.approved_at)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {isSuperAdmin && leave.status === 'pending' && (
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1 rounded-xl h-9 font-bold text-xs cursor-pointer" onClick={() => { onAction(leave.id, 'rejected'); onClose(); }}>Reject</Button>
              <Button className="flex-1 rounded-xl h-9 font-bold text-xs cursor-pointer" onClick={() => { onAction(leave.id, 'approved'); onClose(); }}>Approve</Button>
            </div>
          )}
          {isSuperAdmin && leave.status !== 'pending' && (
            <Button variant="secondary" className="w-full rounded-xl h-9 font-bold text-xs bg-muted/50 cursor-pointer" onClick={() => { onAction(leave.id, 'pending'); onClose(); }}>Reset to Pending</Button>
          )}
          {isSuperAdmin && (
            <Button variant="destructive" className="w-full rounded-xl h-9 font-bold text-xs cursor-pointer bg-destructive/10 text-destructive hover:bg-destructive/20 border-none" onClick={() => { onDelete?.(leave.id); onClose(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Request
            </Button>
          )}
          <Button variant="outline" className="w-full rounded-xl h-9 font-bold text-xs border-muted-foreground/10 cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
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

  const prevMonth = () => setCursor(c => subMonths(c, 1));
  const nextMonth = () => setCursor(c => addMonths(c, 1));
  const goToToday = () => setCursor(new Date());

  function leavesOn(d: Date) {
    return leaves.filter((l) => l.status !== "rejected" && isWithinInterval(d, { start: parseISO(l.from_date), end: parseISO(l.to_date) }));
  }

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b bg-muted/5 p-4 sm:p-6">
        <div>
          <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-primary">
            <CalendarIcon className="h-5 w-5" /> Team Leave Calendar
          </CardTitle>
          <p className="text-xs text-muted-foreground">Overview of employee leave periods.</p>
        </div>
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <h2 className="text-sm font-bold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex border rounded-xl overflow-hidden shadow-sm bg-background">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r cursor-pointer" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" className="h-8 px-3 text-[10px] sm:text-xs font-bold rounded-none border-r cursor-pointer" onClick={goToToday}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none cursor-pointer" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-r last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((d, i) => {
            const dayLeaves = leavesOn(d);
            const inMonth = isSameMonth(d, cursor);
            const isTodayDate = isToday(d);
            const isWeekend = d.getDay() === 5 || d.getDay() === 6;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[80px] sm:min-h-[110px] border-b border-r last:border-r-0 p-1.5 transition-colors",
                  !inMonth && "bg-muted/10 opacity-40",
                  isTodayDate && "bg-primary/5",
                  isWeekend && inMonth && !isTodayDate && "bg-muted/5"
                )}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className={cn(
                    "text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full transition-all",
                    isTodayDate ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
                  )}>
                    {format(d, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayLeaves.map((l) => {
                    const e = employee(l.employee_id);
                    const name = e?.full_name?.split(" ")[0] || "Staff";
                    return (
                      <Popover key={l.id}>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "text-[8px] sm:text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate cursor-pointer active:scale-95 transition-all shadow-sm flex items-center gap-1",
                              LEAVE_TONE[l.type],
                              l.status === "pending" && "opacity-60 border-dashed"
                            )}
                          >
                            <span className="shrink-0">👤</span>
                            <span className="truncate">{name}</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-56 p-3 shadow-xl rounded-2xl border-primary/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-7 w-7 border">
                              {e?.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                              <AvatarFallback className={cn("text-[9px]", avatarColor(e?.full_name || "?"))}>{initials(e?.full_name || "?")}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-xs">{e?.full_name}</p>
                              <Badge className="text-[9px] h-4 py-0" variant="outline">{l.type}</Badge>
                            </div>
                          </div>
                          <div className="space-y-1.5 text-[11px]">
                            <p className="text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-2">
                              "{l.reason || "No reason provided."}"
                            </p>
                            <div className="flex items-center justify-between pt-1 border-t text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span>Status</span>
                              <span className={l.status === "approved" ? "text-success" : "text-warning"}>{l.status}</span>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
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
  const { notifyAdmins } = useMock();
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    employee_id: "",
    type: "casual" as LeaveType,
    from_date: "",
    to_date: "",
    reason: "",
    is_half_day: false,
    half_day_period: "first_half" as HalfDayPeriod,
    start_time: "",
  });
  useEffect(() => {
    if (isSuperAdmin) {
      if (employees.length && !f.employee_id) setF((p) => ({ ...p, employee_id: employees[0].id }));
    } else if (currentEmpId && f.employee_id !== currentEmpId) {
      setF((p) => ({ ...p, employee_id: currentEmpId }));
    }
  }, [employees, isSuperAdmin, currentEmpId, f.employee_id]);

  useEffect(() => {
    if (open) {
      setF({
        employee_id: isSuperAdmin ? (employees[0]?.id || "") : (currentEmpId || ""),
        type: "casual" as LeaveType,
        from_date: "",
        to_date: "",
        reason: "",
        is_half_day: false,
        half_day_period: "first_half" as HalfDayPeriod,
        start_time: "",
      });
    }
  }, [open, isSuperAdmin, employees, currentEmpId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.employee_id) {
      return toast.error(isSuperAdmin ? "Select an employee" : "Employee profile not found. Please contact support.");
    }
    if (!f.from_date) {
      return toast.error("Please select a date");
    }
    if (f.is_half_day && !f.from_date) {
      return toast.error("Please select the half-day date");
    }
    setSubmitting(true);

    // For half-day leaves: from_date and to_date are the same
    const toDate = f.is_half_day ? f.from_date : (f.to_date || f.from_date);

    const payload: any = {
      employee_id: f.employee_id,
      type: f.type,
      from_date: f.from_date,
      to_date: toDate,
      reason: f.reason || null,
      status: "pending" as const,
      is_half_day: f.is_half_day,
      half_day_period: f.is_half_day ? f.half_day_period : null,
      start_time: f.is_half_day && f.start_time ? f.start_time : null,
    };

    const { error } = await supabase.from("leave_requests").insert([payload]);
    setSubmitting(false);
    if (error) return toast.error(error.message);

    // Notify Admins
    const emp = employees.find(e => e.id === f.employee_id);
    const leaveDesc = f.is_half_day ? `half-day ${f.type}` : f.type;
    await notifyAdmins({
      title: "New Leave Request",
      body: `${emp?.full_name || "An employee"} has requested a ${leaveDesc} leave.`,
      type: "info"
    });

    toast.success("Leave request submitted");
    onOpenChange(false);
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New request</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New leave request</SheetTitle>
          <SheetDescription>
            {isSuperAdmin ? "Submit on behalf of an employee." : "Request time off for yourself."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          {isSuperAdmin && (
            <Fld label="Employee">
              <Select
                value={f.employee_id}
                onValueChange={(v) => setF({ ...f, employee_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          )}
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

          {/* Leave Duration toggle: Full Day vs Half Day */}
          <div className="space-y-2">
            <Label className="text-xs">Leave Duration</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border">
              <button
                type="button"
                onClick={() => setF({ ...f, is_half_day: false })}
                className={cn(
                  "h-9 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  !f.is_half_day ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Full Day(s)
              </button>
              <button
                type="button"
                onClick={() => setF({ ...f, is_half_day: true, to_date: f.from_date })}
                className={cn(
                  "h-9 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  f.is_half_day ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Half Day
              </button>
            </div>
          </div>

          {f.is_half_day ? (
            <>
              <Fld label="Date">
                <FlatDatePicker
                  date={f.from_date}
                  onChange={d => setF({ ...f, from_date: d, to_date: d })}
                  placeholder="Select date"
                />
              </Fld>
              <Fld label="Half Period">
                <Select value={f.half_day_period} onValueChange={(v) => setF({ ...f, half_day_period: v as HalfDayPeriod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_half">First Half (Morning) — সকাল</SelectItem>
                    <SelectItem value="second_half">Second Half (Afternoon) — বিকাল</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label="Leave Start Time (optional)">
                <FlatTimePicker
                  value={f.start_time}
                  onChange={v => setF({ ...f, start_time: v })}
                  placeholder="e.g. 1:30 PM (when leaving early)"
                />
              </Fld>
              <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2.5 border border-dashed">
                <span className="font-semibold">ℹ️ Half-day leave</span> = 0.5 day deducted from leave balance. Use start time if leaving mid-day.
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Fld label="From">
                <FlatDatePicker
                  date={f.from_date}
                  onChange={d => setF({ ...f, from_date: d })}
                  placeholder="From"
                />
              </Fld>
              <Fld label="To">
                <FlatDatePicker
                  date={f.to_date}
                  onChange={d => setF({ ...f, to_date: d })}
                  placeholder="To"
                />
              </Fld>
            </div>
          )}

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
