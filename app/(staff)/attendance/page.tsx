"use client";

import { useState, useMemo, useEffect } from "react";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isWithinInterval, parseISO, isToday
} from "date-fns";
import { useMock } from "../../../lib/mock-store";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import {
  Clock, LogIn, LogOut, FileDown, FileSpreadsheet,
  Calendar as CalendarIcon, Coffee, Settings2,
  CalendarCheck2, Trash2, Save, Plus, AlertCircle,
  ChevronLeft, ChevronRight, Smartphone, RotateCcw, Edit3, Trash
} from "lucide-react";
import { initials, avatarColor, formatDate, toLocalDateString } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";

type RangeType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export default function AttendancePage() {
  const {
    employees, attendance, toggleClock, loading, updateEmployee,
    updateAttendance, deleteAttendance, addManualAttendance
  } = useMock();
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const currentUserEmp = employees.find(e => e.profile_id === user?.id) ||
    employees.find(e => e.email === user?.email);
  const activeEmployees = employees.filter(e => e.status !== "disabled");
  const displayEmployees = isSuperAdmin ? activeEmployees : (currentUserEmp && currentUserEmp.status !== "disabled" ? [currentUserEmp] : []);

  const [activeTab, setActiveTab] = useState("roster");
  const today = toLocalDateString();

  // Database States
  const [holidays, setHolidays] = useState<{ date: string, name: string, id?: string }[]>([]);
  const [officeSettings, setOfficeSettings] = useState<{ start: string, end: string, weekend: number }>({
    start: "09:00", end: "18:00", weekend: 5
  });
  const [leaves, setLeaves] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [overrideHoliday, setOverrideHoliday] = useState(false);

  // New Holiday Input States
  const [newHDate, setNewHDate] = useState("");
  const [newHName, setNewHName] = useState("");

  // Report State
  const [rangeType, setRangeType] = useState<RangeType>("monthly");
  const [startDate, setStartDate] = useState(toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(today);

  // Edit States
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [manualEntry, setManualEntry] = useState<any>(null);
  const [editForm, setEditForm] = useState({ clockIn: "", clockOut: "", date: "", employeeId: "" });

  // Filtering States
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // all, late, absent, present, leave

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    void loadData();
  }, []);

  const handleEditClick = (entry: any) => {
    setEditingEntry(entry);
    const cin = entry.clock_in ? new Date(entry.clock_in) : null;
    const cout = entry.clock_out ? new Date(entry.clock_out) : null;

    setEditForm({
      clockIn: cin ? `${String(cin.getHours()).padStart(2, "0")}:${String(cin.getMinutes()).padStart(2, "0")}` : "",
      clockOut: cout ? `${String(cout.getHours()).padStart(2, "0")}:${String(cout.getMinutes()).padStart(2, "0")}` : "",
      date: entry.date,
      employeeId: entry.employee_id
    });
  };

  const isLate = (clockIn: string | null, emp: any) => {
    if (!clockIn || !emp) return false;

    // Skip for Management department or Super Admin designation
    if (emp.department === "Management" || emp.designation === "Super Admin") return false;

    // Use employee's custom office_start if available, else fallback to global setting
    const officeStart = emp.office_start || officeSettings.start;
    const [startH, startM] = officeStart.split(":").map(Number);
    const d = new Date(clockIn);
    const clockInH = d.getHours();
    const clockInM = d.getMinutes();

    const startTimeInMinutes = startH * 60 + startM;
    const clockInTimeInMinutes = clockInH * 60 + clockInM;

    return clockInTimeInMinutes > (startTimeInMinutes + 15);
  };

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";


  const handleManualClick = () => {
    setManualEntry(true);
    setEditForm({
      clockIn: "09:00",
      clockOut: "18:00",
      date: today,
      employeeId: employees[0]?.id || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.clockIn) {
      toast.error("Clock in time is required");
      return;
    }

    try {
      const [hIn, mIn] = editForm.clockIn.split(":");
      const [y, mo, d] = editForm.date.split("-");

      const clockInDate = new Date(Number(y), Number(mo) - 1, Number(d), Number(hIn), Number(mIn));
      const clockInIso = clockInDate.toISOString();

      let clockOutIso = null;
      if (editForm.clockOut) {
        const [hOut, mOut] = editForm.clockOut.split(":");
        const clockOutDate = new Date(Number(y), Number(mo) - 1, Number(d), Number(hOut), Number(mOut));
        clockOutIso = clockOutDate.toISOString();
      }

      if (editingEntry && !editingEntry.isVirtual) {
        await updateAttendance(editingEntry.id, {
          clock_in: clockInIso,
          clock_out: clockOutIso,
          date: editForm.date
        });
      } else {
        await addManualAttendance(editForm.employeeId, editForm.date, clockInIso, clockOutIso);
      }
      setEditingEntry(null);
      setManualEntry(null);
    } catch (err) {
      console.error(err);
    }
  };

  async function loadData() {
    setFetching(true);
    try {
      const { data: hData } = await supabase.from("company_holidays" as any).select("*").order("date", { ascending: true });
      if (hData) setHolidays(hData as any);

      const { data: sData } = await supabase.from("workspace_settings" as any).select("*").eq("key", "office_hours").maybeSingle();
      if (sData) setOfficeSettings((sData as any)?.value);

      const { data: lData } = await supabase.from("leave_requests" as any).select("*").eq("status", "approved");
      if (lData) setLeaves(lData as any || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setFetching(false);
    }
  }

  const isTodayHoliday = useMemo(() => {
    return (new Date().getDay() === officeSettings.weekend) || holidays.some(h => h.date === today);
  }, [officeSettings.weekend, holidays, today]);

  const holidayName = useMemo(() => {
    if (new Date().getDay() === officeSettings.weekend) return "Weekly Holiday";
    return holidays.find(h => h.date === today)?.name || "Office Holiday";
  }, [officeSettings.weekend, holidays, today]);

  async function addHoliday() {
    if (!newHDate || !newHName) {
      toast.error("Please fill both date and name");
      return;
    }
    const { data, error } = await supabase.from("company_holidays" as any).insert([{ date: newHDate, name: newHName }]).select();
    if (!error && data) {
      setHolidays([...holidays, (data as any)[0]]);
      setNewHDate("");
      setNewHName("");
      toast.success("Holiday added");
    } else {
      console.error(error);
      toast.error("Could not add holiday. Make sure the table exists.");
    }
  }

  async function deleteHoliday(id: string) {
    const { error } = await supabase.from("company_holidays" as any).delete().eq("id", id);
    if (!error) {
      setHolidays(holidays.filter(h => h.id !== id));
      toast.success("Holiday removed");
    }
  }

  async function resetDevice(id: string) {
    updateEmployee(id, { registered_device_id: null } as any);
  }

  async function saveSettings() {
    const { error } = await supabase.from("workspace_settings" as any).upsert({ key: "office_hours", value: officeSettings }, { onConflict: "key" });
    if (!error) toast.success("Office settings updated");
    else toast.error("Error updating settings");
  }

  const displayAttendance = useMemo(() => {
    return attendance.filter(a => a.date === today);
  }, [attendance, today]);

  const reportData = useMemo(() => {
    const data: any[] = [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Get all dates in interval
    const intervalDays = eachDayOfInterval({ start, end });

    for (const d of intervalDays) {
      const dStr = toLocalDateString(d);
      const isWeekend = d.getDay() === officeSettings.weekend;
      const holiday = holidays.find(h => h.date === dStr);
      const isHoliday = isWeekend || !!holiday;

      for (const emp of displayEmployees) {
        const a = attendance.find(x => x.employee_id === emp.id && x.date === dStr);
        const leave = leaves.find(l =>
          l.employee_id === emp.id &&
          dStr >= l.from_date &&
          dStr <= l.to_date &&
          l.status === 'approved'
        );

        if (a) {
          data.push({ ...a, employee: emp, isOnLeave: !!leave, isHoliday });
        } else if (dStr <= today) {
          if (leave) {
            data.push({
              id: `leave-${emp.id}-${dStr}`,
              employee_id: emp.id,
              date: dStr,
              clock_in: null,
              clock_out: null,
              employee: emp,
              isOnLeave: true,
              isHoliday,
              status: 'leave',
              isVirtual: true
            });
          } else if (!isHoliday) {
            data.push({
              id: `absent-${emp.id}-${dStr}`,
              employee_id: emp.id,
              date: dStr,
              clock_in: null,
              clock_out: null,
              employee: emp,
              isOnLeave: false,
              isHoliday: false,
              isAbsent: true,
              isVirtual: true
            });
          }
        }
      }
    }
    let filtered = data;

    // Apply filters
    if (filterEmployeeId !== "all") {
      filtered = filtered.filter(r => r.employee_id === filterEmployeeId);
    }

    if (filterStatus === "late") {
      filtered = filtered.filter(r => !r.isAbsent && !r.isOnLeave && isLate(r.clock_in, r.employee));
    } else if (filterStatus === "absent") {
      filtered = filtered.filter(r => r.isAbsent);
    } else if (filterStatus === "present") {
      filtered = filtered.filter(r => !r.isAbsent && !r.isOnLeave && r.clock_in);
    } else if (filterStatus === "leave") {
      filtered = filtered.filter(r => r.isOnLeave);
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, leaves, rangeType, startDate, endDate, employees, holidays, officeSettings, today, displayEmployees, filterEmployeeId, filterStatus]);

  const totalPages = Math.ceil(reportData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reportData.slice(start, start + pageSize);
  }, [reportData, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterEmployeeId, filterStatus, rangeType, startDate, endDate, pageSize]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 15);
    autoTable(doc, {
      startY: 30,
      head: [["Date", "Employee", "Dept", "Clock In", "Clock Out", "Status"]],
      body: reportData.map(r => [
        r.date,
        r.employee?.full_name || "—",
        r.employee?.department || "—",
        fmtTime(r.clock_in),
        fmtTime(r.clock_out),
        r.isOnLeave ? "On Leave" : (r.clock_out ? "Present" : "In")
      ]),
    });
    doc.save(`attendance_report_${startDate}.pdf`);
  };

  if (loading || fetching) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-6">
        <div className="flex gap-2 p-1 bg-muted/20 rounded-lg w-full max-w-[650px]">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="border rounded-2xl p-6 space-y-6 shadow-md bg-card">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-muted/30 p-4 border-b">
              <div className="grid grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 border-b last:border-b-0 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-1/6" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-muted-foreground mt-1">Monitor and report employee presence.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className={cn(
            "inline-flex w-auto md:grid md:w-full md:max-w-[650px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap",
            isSuperAdmin ? "md:grid-cols-4" : "md:grid-cols-3"
          )}>
            <TabsTrigger value="roster" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Clock className="h-4 w-4" /> Today's Roster</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><FileSpreadsheet className="h-4 w-4" /> Reports</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><CalendarIcon className="h-4 w-4" /> Calendar</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="settings" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Settings2 className="h-4 w-4" /> Settings & Holidays</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="roster" className="space-y-6">
          <Card className="border-none shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold">{isSuperAdmin ? "Real-time Status" : "My Attendance Status"}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="whitespace-nowrap">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                  {isTodayHoliday && !overrideHoliday && (
                    <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                      <Coffee className="h-3 w-3" /> {holidayName}
                    </Badge>
                  )}
                </CardDescription>
              </div>
              {isTodayHoliday && (
                <div className="flex items-center justify-between w-full sm:w-auto gap-3 p-2 bg-background/50 rounded-lg border">
                  <span className="text-xs font-medium">Work on holiday?</span>
                  <Button
                    variant={overrideHoliday ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-3 rounded-md transition-all cursor-pointer"
                    onClick={() => setOverrideHoliday(!overrideHoliday)}
                  >
                    {overrideHoliday ? "Enabled" : "Off"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:px-6 sm:pb-6 sm:pt-0">
              {/* Desktop View */}
              <div className="hidden md:block rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30"><TableRow>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Department</TableHead>
                    <TableHead className="font-bold">Clock in</TableHead>
                    <TableHead className="font-bold">Clock out</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {displayEmployees.map((e) => {
                      const a = displayAttendance.find((x) => x.employee_id === e.id);
                      const isOnLeave = leaves.some(l =>
                        l.employee_id === e.id &&
                        today >= l.from_date &&
                        today <= l.to_date
                      );
                      const status = !a?.clock_in
                        ? (isOnLeave ? "leave" : (isTodayHoliday && !overrideHoliday ? "holiday" : "absent"))
                        : (a.clock_out ? "out" : "in");
                      return (
                        <TableRow key={e.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                                <AvatarFallback className={cn("text-white font-bold", avatarColor(e.full_name))}>{initials(e.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-sm">{e.full_name}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{e.designation}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="font-medium">{e.department}</Badge></TableCell>
                          <TableCell className="font-mono text-xs font-bold">{fmtTime(a?.clock_in ?? null)}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{fmtTime(a?.clock_out ?? null)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {status === "in" && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0.5">Working</Badge>}
                              {status === "out" && <Badge variant="secondary" className="px-2 py-0.5">Done</Badge>}
                              {status === "absent" && <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5">Absent</Badge>}
                              {status === "holiday" && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 px-2 py-0.5">Holiday</Badge>}
                              {status === "leave" && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 px-2 py-0.5">On Leave</Badge>}
                              {(status === "in" || status === "out") && isLate(a?.clock_in ?? null, e) && (
                                <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 animate-pulse">Late</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {status === "leave" ? (
                              <Badge variant="outline" className="bg-muted/50 border-dashed">On Leave</Badge>
                            ) : isTodayHoliday && !overrideHoliday && !a?.clock_in ? (
                              <Badge variant="outline" className="bg-muted/50 border-dashed">Holiday</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                {status === "absent" && (
                                  <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-sm h-8" onClick={() => toggleClock(e.id)}>
                                    <LogIn className="h-3.5 w-3.5 mr-1.5" /> Clock in
                                  </Button>
                                )}
                                {status === "in" && (
                                  <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5 h-8" onClick={() => toggleClock(e.id)}>
                                    <LogOut className="h-3.5 w-3.5 mr-1.5" /> Clock out
                                  </Button>
                                )}
                                {status === "out" && <span className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded">COMPLETED</span>}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {displayEmployees.map((e) => {
                  const a = displayAttendance.find((x) => x.employee_id === e.id);
                  const isOnLeave = leaves.some(l =>
                    l.employee_id === e.id &&
                    today >= l.from_date &&
                    today <= l.to_date
                  );
                  const status = !a?.clock_in
                    ? (isOnLeave ? "leave" : (isTodayHoliday && !overrideHoliday ? "holiday" : "absent"))
                    : (a.clock_out ? "out" : "in");

                  return (
                    <div key={e.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            {e.avatar_url && <AvatarImage src={e.avatar_url} className="object-cover" />}
                            <AvatarFallback className={cn("text-white font-bold", avatarColor(e.full_name))}>{initials(e.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-sm">{e.full_name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{e.designation}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{e.department}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 py-2 border-y border-dashed">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Clock In</p>
                          <p className="font-mono text-xs font-bold">{fmtTime(a?.clock_in ?? null)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Clock Out</p>
                          <p className="font-mono text-xs font-bold">{fmtTime(a?.clock_out ?? null)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1">
                          {status === "in" && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0.5 text-[10px]">Working</Badge>}
                          {status === "out" && <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">Done</Badge>}
                          {status === "absent" && <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 text-[10px]">Absent</Badge>}
                          {status === "holiday" && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 px-2 py-0.5 text-[10px]">Holiday</Badge>}
                          {status === "leave" && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 px-2 py-0.5 text-[10px]">On Leave</Badge>}
                          {(status === "in" || status === "out") && isLate(a?.clock_in ?? null, e) && (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 text-[10px] animate-pulse">Late</Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {status === "absent" && (
                            <Button size="sm" className="h-8 text-[11px] font-bold" onClick={() => toggleClock(e.id)}>
                              <LogIn className="h-3 w-3 mr-1" /> Clock in
                            </Button>
                          )}
                          {status === "in" && (
                            <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5 h-8 text-[11px] font-bold" onClick={() => toggleClock(e.id)}>
                              <LogOut className="h-3 w-3 mr-1" /> Clock out
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <AttendanceCalendar leaves={leaves} holidays={holidays} employees={displayEmployees} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader className="p-4 sm:pb-3 border-b bg-muted/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Attendance Reports</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">View and export historical attendance data.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isSuperAdmin && (
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 font-semibold border-primary text-primary cursor-pointer" onClick={handleManualClick}>
                      <Plus className="h-4 w-4 mr-2" /> Manual Entry
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 font-semibold cursor-pointer" onClick={exportPDF}>
                    <FileDown className="h-4 w-4 mr-2 text-red-500" /> Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:pt-6 sm:space-y-6">
              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-end gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl bg-muted/20 border border-muted-foreground/10">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Range Type</Label>
                  <Select value={rangeType} onValueChange={(v: RangeType) => setRangeType(v)}>
                    <SelectTrigger className="w-full sm:w-[140px] py-[6px] h-auto rounded-lg shadow-sm cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {rangeType === "custom" && (
                  <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From</Label>
                      <div className="w-full sm:w-[180px]"><FlatDatePicker date={startDate} onChange={setStartDate} placeholder="Start Date" /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To</Label>
                      <div className="w-full sm:w-[180px]"><FlatDatePicker date={endDate} onChange={setEndDate} placeholder="End Date" /></div>
                    </div>
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Staff Wise</Label>
                    <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
                      <SelectTrigger className="w-full sm:w-[180px] py-[6px] h-auto rounded-lg shadow-sm cursor-pointer"><SelectValue placeholder="All Employees" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">All Staff</SelectItem>
                        {activeEmployees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status Filter</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[140px] py-[6px] h-auto rounded-lg shadow-sm cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present Only</SelectItem>
                      <SelectItem value="late">Late Only</SelectItem>
                      <SelectItem value="absent">Absent Only</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Desktop Report Table */}
              <div className="hidden md:block mt-6 rounded-xl border shadow-sm overflow-x-auto scrollbar-hide">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader className="bg-muted/50"><TableRow>
                      <TableHead className="py-2 px-4 font-bold">Date</TableHead>
                      <TableHead className="py-2 px-4 font-bold">Employee</TableHead>
                      <TableHead className="py-2 px-4 font-bold">Clock In</TableHead>
                      <TableHead className="py-2 px-4 font-bold">Clock Out</TableHead>
                      <TableHead className="py-2 px-4 font-bold text-center">IP Address</TableHead>
                      <TableHead className="py-2 px-4 font-bold">Status</TableHead>
                      {isSuperAdmin && <TableHead className="py-2 px-4 text-right font-bold">Actions</TableHead>}
                    </TableRow></TableHeader>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isSuperAdmin ? 7 : 6} className="h-32 text-center text-muted-foreground italic">
                            No records found for selected period and filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedData.map((r, i) => (
                          <TableRow key={i} className="hover:bg-muted/5">
                            <TableCell className="py-2 px-4 font-medium text-sm">{formatDate(r.date)}</TableCell>
                            <TableCell className="py-2 px-4">
                              <div className="font-semibold text-sm">{r.employee?.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">{r.employee?.department}</div>
                            </TableCell>
                            <TableCell className="py-2 px-4 font-mono text-xs font-bold">{fmtTime(r.clock_in)}</TableCell>
                            <TableCell className="py-2 px-4 font-mono text-xs font-bold">{fmtTime(r.clock_out)}</TableCell>
                            <TableCell className="py-2 px-4 text-center font-mono text-[10px] text-muted-foreground">{r.ip_address || "—"}</TableCell>
                            <TableCell className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={r.isAbsent ? "destructive" : (r.isOnLeave ? "outline" : "secondary")}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold",
                                    r.isOnLeave && "bg-orange-500/10 text-orange-600 border-orange-500/20",
                                    r.isAbsent && "bg-red-500/10 text-red-600 border-red-500/20"
                                  )}
                                >
                                  {r.isAbsent ? "ABSENT" : (r.isOnLeave ? "ON LEAVE" : (r.clock_out ? "PRESENT" : "ACTIVE"))}
                                </Badge>
                                {!r.isOnLeave && !r.isAbsent && isLate(r.clock_in, r.employee) && (
                                  <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 text-[10px] font-bold">LATE</Badge>
                                )}
                              </div>
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell className="py-2 px-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary cursor-pointer" onClick={() => handleEditClick(r)}>
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  {!r.isVirtual && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteAttendance(r.id)}>
                                      <Trash className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Report Cards */}
              <div className="md:hidden mt-6 space-y-3">
                {paginatedData.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground italic text-sm bg-muted/5 rounded-xl border border-dashed">
                    No records found for selected filters.
                  </div>
                ) : (
                  paginatedData.map((r, i) => (
                    <div key={i} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
                          <p className="font-semibold text-sm">{formatDate(r.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Badge
                              variant={r.isAbsent ? "destructive" : (r.isOnLeave ? "outline" : "secondary")}
                              className={cn(
                                "px-2 py-0.5 text-[10px] font-bold",
                                r.isOnLeave && "bg-orange-500/10 text-orange-600 border-orange-500/20",
                                r.isAbsent && "bg-red-500/10 text-red-600 border-red-500/20"
                              )}
                            >
                              {r.isAbsent ? "ABSENT" : (r.isOnLeave ? "ON LEAVE" : (r.clock_out ? "PRESENT" : "ACTIVE"))}
                            </Badge>
                            {!r.isOnLeave && !r.isAbsent && isLate(r.clock_in, r.employee) && (
                              <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 px-2 py-0.5 text-[10px] font-bold">LATE</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 py-2 border-y border-dashed">
                        <Avatar className="h-8 w-8 border shadow-sm">
                          {r.employee?.avatar_url && <AvatarImage src={r.employee.avatar_url} className="object-cover" />}
                          <AvatarFallback className={cn("text-[10px] text-white font-bold", avatarColor(r.employee?.full_name || ""))}>{initials(r.employee?.full_name || "")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">{r.employee?.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.employee?.department}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Clock In</p>
                          <p className="font-mono text-xs font-bold">{fmtTime(r.clock_in)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Clock Out</p>
                          <p className="font-mono text-xs font-bold">{fmtTime(r.clock_out)}</p>
                        </div>
                      </div>

                      {isSuperAdmin && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <p className="text-[10px] text-muted-foreground font-mono">IP: {r.ip_address || "—"}</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-primary border-primary/20" onClick={() => handleEditClick(r)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            {!r.isVirtual && (
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive border-destructive/20" onClick={() => deleteAttendance(r.id)}>
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 sm:py-3 border-t bg-muted/20 rounded-b-xl">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Showing <span className="font-bold text-foreground">{Math.min(paginatedData.length, pageSize)}</span> of <span className="font-bold text-foreground">{reportData.length}</span> records
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Show</Label>
                  <Select value={pageSize.toString()} onValueChange={v => setPageSize(Number(v))}>
                    <SelectTrigger className="h-7 w-16 text-xs rounded-md cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md px-2 text-[11px] sm:text-xs cursor-pointer"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-0 sm:mr-1" /> <span className="hidden sm:inline">Prev</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    if (pageNum <= 0) return null;
                    if (pageNum > totalPages) return null;

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-md p-0 text-[11px] sm:text-xs cursor-pointer"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md px-2 text-[11px] sm:text-xs cursor-pointer"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4 ml-0 sm:ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-primary" /> Office Holidays
                </CardTitle>
                <CardDescription>Manage official holidays and weekly weekends.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col gap-4 p-4 bg-muted/20 rounded-2xl border border-dashed border-primary/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Select Date</Label>
                    <FlatDatePicker date={newHDate} onChange={setNewHDate} placeholder="Choose holiday date" className="cursor-pointer" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Holiday Name</Label>
                    <Input placeholder="e.g. Eid-ul-Fitr" value={newHName} onChange={e => setNewHName(e.target.value)} className="rounded-xl h-10" />
                  </div>
                  <Button className="w-full rounded-xl shadow-md h-10 font-bold cursor-pointer" onClick={addHoliday}>
                    <Plus className="h-4 w-4 mr-2" /> Add Holiday
                  </Button>
                </div>

                <div className="rounded-xl border shadow-sm">
                  <Table>
                    <TableBody>
                      {holidays.length === 0 ? (
                        <TableRow><TableCell className="h-20 text-center text-muted-foreground text-xs italic">No holidays added yet.</TableCell></TableRow>
                      ) : (
                        holidays.map((h, i) => (
                          <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="font-semibold text-sm">{formatDate(h.date)}</TableCell>
                            <TableCell className="text-sm font-medium">{h.name}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteHoliday(h.id!)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" /> Office Hours & Weekend
                </CardTitle>
                <CardDescription>Configure standard working hours and weekends.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Start Time</Label>
                    <div className="relative">
                      <Input type="time" value={officeSettings.start} onChange={e => setOfficeSettings({ ...officeSettings, start: e.target.value })} className="rounded-xl h-10 pl-9" />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">End Time</Label>
                    <div className="relative">
                      <Input type="time" value={officeSettings.end} onChange={e => setOfficeSettings({ ...officeSettings, end: e.target.value })} className="rounded-xl h-10 pl-9" />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">Weekly Weekend</Label>
                  <Select value={officeSettings.weekend.toString()} onValueChange={v => setOfficeSettings({ ...officeSettings, weekend: parseInt(v) })}>
                    <SelectTrigger className="h-10 rounded-xl shadow-sm cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="5">Friday (Recommended)</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                      <SelectItem value="0">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-primary" /> Changes will apply to all employees immediately.
                  </p>
                </div>

                <Button className="w-full rounded-xl shadow-md h-11 font-bold bg-primary hover:bg-primary/90 cursor-pointer" onClick={saveSettings}>
                  <Save className="h-4 w-4 mr-2" /> Save Global Settings
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden md:col-span-2">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" /> Device Management
                </CardTitle>
                <CardDescription>Reset registered devices for staff members.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto px-5">
                  <Table>
                    <TableHeader className="bg-muted/30"><TableRow>
                      <TableHead className="font-bold text-xs">Employee</TableHead>
                      <TableHead className="font-bold text-xs">Registered Device</TableHead>
                      <TableHead className="text-right font-bold text-xs">Action</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {employees.map(e => (
                        <TableRow key={e.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="font-medium text-sm">{e.full_name}</TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground">{e.registered_device_id ? e.registered_device_id.slice(0, 24) + "..." : "No device bound"}</TableCell>
                          <TableCell className="text-right">
                            {e.registered_device_id ? (
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer" onClick={() => resetDevice(e.id)}>
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Device
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic mr-2">Ready to bind</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3 p-4 bg-muted/10">
                  {employees.map(e => (
                    <div key={e.id} className="bg-background rounded-2xl p-4 border border-border/50 shadow-sm">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm text-foreground">{e.full_name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Smartphone className="h-3 w-3 text-muted-foreground" />
                              <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                                {e.registered_device_id || "No device bound"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                          {e.registered_device_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-10 rounded-xl text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 font-bold text-xs"
                              onClick={() => resetDevice(e.id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset Registered Device
                            </Button>
                          ) : (
                            <div className="flex items-center justify-center py-2 bg-muted/20 rounded-lg">
                              <span className="text-[11px] text-muted-foreground italic font-medium">✨ Ready to bind new device</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit / Manual Entry Dialog */}
      <Dialog open={!!editingEntry || !!manualEntry} onOpenChange={(open) => { if (!open) { setEditingEntry(null); setManualEntry(null); } }}>
        <DialogContent className="w-[92%] max-w-[425px] rounded-3xl mx-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Attendance" : "Manual Attendance Entry"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "Modify clock-in and clock-out times for this record." : "Create a new attendance record manually."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {manualEntry && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Staff</Label>
                <div className="col-span-3">
                  <Select value={editForm.employeeId} onValueChange={(v) => setEditForm({ ...editForm, employeeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                    <SelectContent>
                      {displayEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Date</Label>
              <div className="col-span-3">
                <FlatDatePicker date={editForm.date} onChange={(d) => setEditForm({ ...editForm, date: d })} />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Clock In</Label>
              <Input
                type="time"
                value={editForm.clockIn}
                onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Clock Out</Label>
              <Input
                type="time"
                value={editForm.clockOut}
                onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="outline" className="rounded-xl h-11" onClick={() => { setEditingEntry(null); setManualEntry(null); }}>Cancel</Button>
            <Button className="rounded-xl h-11 bg-primary hover:bg-primary/90" onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>;
}

function AttendanceCalendar({ leaves, holidays, employees }: { leaves: any[]; holidays: any[]; employees: any[] }) {
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const nextMonth = () => setCursor(addMonths(cursor, 1));
  const prevMonth = () => setCursor(subMonths(cursor, 1));
  const goToToday = () => setCursor(new Date());

  function eventsOn(d: Date) {
    const dStr = format(d, "yyyy-MM-dd");
    const dayHolidays = holidays.filter(h => h.date === dStr);
    const dayLeaves = leaves.filter(l => l.status === "approved" && isWithinInterval(d, { start: parseISO(l.from_date), end: parseISO(l.to_date) }));
    return { holidays: dayHolidays, leaves: dayLeaves };
  }

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b bg-muted/5 p-4 sm:p-6">
        <div>
          <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            Holiday & Leave Calendar
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Visual overview of team presence and holidays.</CardDescription>
        </div>
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <h2 className="text-sm font-bold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex border rounded-xl overflow-hidden shadow-sm">
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
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const { holidays: hols, leaves: lvs } = eventsOn(d);
            const isTodayDate = isToday(d);
            const isCurrentMonth = isSameMonth(d, monthStart);
            const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Friday/Saturday for BD

            const isFriday = d.getDay() === 5;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[70px] sm:min-h-[100px] p-1 sm:p-2 border-r border-b last:border-r-0 transition-colors",
                  !isCurrentMonth && "bg-muted/10 opacity-40",
                  isTodayDate && "bg-primary/5",
                  isWeekend && !isTodayDate && isCurrentMonth && "bg-muted/5"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full",
                    isTodayDate && "bg-primary text-primary-foreground shadow-sm"
                  )}>
                    {format(d, "d")}
                  </span>
                </div>

                <div className="space-y-1 overflow-hidden">
                  {isFriday && isCurrentMonth && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-muted text-muted-foreground border border-muted-foreground/20 truncate cursor-pointer active:scale-95 transition-transform">
                          🏠<span className="hidden sm:inline ml-1">Weekend</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="w-auto p-2 text-xs font-medium">
                        Weekend (Friday)
                      </PopoverContent>
                    </Popover>
                  )}
                  {hols.map((h, idx) => (
                    <Popover key={`h-${idx}`}>
                      <PopoverTrigger asChild>
                        <div className="px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20 truncate cursor-pointer active:scale-95 transition-transform">
                          ⭐<span className="hidden sm:inline ml-1">{h.name}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="w-auto p-2 text-xs font-medium">
                        Holiday: {h.name}
                      </PopoverContent>
                    </Popover>
                  ))}
                  {lvs.map((l, idx) => {
                    const emp = employees.find(e => e.id === l.employee_id);
                    const name = emp?.full_name?.split(' ')[0] || "Staff";
                    return (
                      <Popover key={`l-${idx}`}>
                        <PopoverTrigger asChild>
                          <div className="px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 truncate cursor-pointer active:scale-95 transition-transform">
                            👤<span className="hidden sm:inline ml-1">{name}</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-48 p-3 shadow-xl rounded-xl">
                          <p className="font-bold text-sm text-primary mb-1">{emp?.full_name}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-bold">Reason:</span> {l.reason}
                          </p>
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
