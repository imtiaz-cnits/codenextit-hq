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
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import {
  Clock, LogIn, LogOut, FileDown, FileSpreadsheet,
  Calendar as CalendarIcon, Coffee, Settings2,
  CalendarCheck2, Trash2, Save, Plus, AlertCircle,
  ChevronLeft, ChevronRight, Smartphone, RotateCcw
} from "lucide-react";
import { initials, avatarColor, formatDate, toLocalDateString } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RangeType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export default function AttendancePage() {
  const { employees, attendance, toggleClock, loading } = useMock();
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const currentUserEmp = employees.find(e => e.profile_id === user?.id) ||
    employees.find(e => e.email === user?.email);
  const displayEmployees = isSuperAdmin ? employees : (currentUserEmp ? [currentUserEmp] : []);

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

  useEffect(() => {
    void loadData();
  }, []);

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
      setHolidays([...holidays, data[0]]);
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
    return attendance.filter((a) => {
      const rowDate = a.date.slice(0, 10);
      if (rangeType === "daily") return rowDate === today;
      return rowDate >= startDate && rowDate <= endDate;
    }).map(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      const isOnLeave = leaves.some(l =>
        l.employee_id === a.employee_id &&
        a.date.slice(0, 10) >= l.from_date &&
        a.date.slice(0, 10) <= l.to_date
      );
      return { ...a, employee: emp, isOnLeave };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, leaves, rangeType, startDate, endDate, employees, today]);

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

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

  if (loading || fetching) return <div className="h-[400px] flex items-center justify-center animate-pulse">Loading Attendance System...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-muted-foreground mt-1">Monitor and report employee presence.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={cn("grid w-full max-w-[650px]", isSuperAdmin ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="roster" className="gap-2"><Clock className="h-4 w-4" /> Today's Roster</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Reports</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" /> Calendar</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="settings" className="gap-2"><Settings2 className="h-4 w-4" /> Settings & Holidays</TabsTrigger>}
        </TabsList>

        <TabsContent value="roster" className="space-y-6">
          <Card className="border-none shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">{isSuperAdmin ? "Real-time Status" : "My Attendance Status"}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  {isTodayHoliday && !overrideHoliday && (
                    <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                      <Coffee className="h-3 w-3" /> {holidayName}
                    </Badge>
                  )}
                </CardDescription>
              </div>
              {isTodayHoliday && (
                <div className="flex items-center gap-3 p-2 bg-background/50 rounded-lg border">
                  <span className="text-xs font-medium">Work on holiday?</span>
                  <Button
                    variant={overrideHoliday ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-3 rounded-md transition-all"
                    onClick={() => setOverrideHoliday(!overrideHoliday)}
                  >
                    {overrideHoliday ? "Enabled" : "Off"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
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
                      const status = !a?.clock_in ? (isOnLeave ? "leave" : "absent") : a.clock_out ? "out" : "in";
                      return (
                        <TableRow key={e.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
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
                            {status === "in" && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0.5">Working</Badge>}
                            {status === "out" && <Badge variant="secondary" className="px-2 py-0.5">Done</Badge>}
                            {status === "absent" && <Badge variant="outline" className="text-muted-foreground opacity-60 px-2 py-0.5">Not in</Badge>}
                            {status === "leave" && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 px-2 py-0.5">On Leave</Badge>}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <AttendanceCalendar leaves={leaves} holidays={holidays} employees={employees} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-3 border-b bg-muted/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Attendance Reports</CardTitle>
                  <CardDescription>View and export historical attendance data.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-9 font-semibold" onClick={exportPDF}>
                  <FileDown className="h-4 w-4 mr-2 text-red-500" /> Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-wrap items-end gap-4 p-5 rounded-2xl bg-muted/20 border border-muted-foreground/10">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Range Type</Label>
                  <Select value={rangeType} onValueChange={(v: RangeType) => setRangeType(v)}>
                    <SelectTrigger className="w-[140px] h-10 rounded-xl shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {rangeType === "custom" && (
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From</Label>
                      <div className="w-[180px]"><FlatDatePicker date={startDate} onChange={setStartDate} placeholder="Start Date" /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To</Label>
                      <div className="w-[180px]"><FlatDatePicker date={endDate} onChange={setEndDate} placeholder="End Date" /></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Clock In</TableHead>
                    <TableHead className="font-bold">Clock Out</TableHead>
                    <TableHead className="font-bold text-center">IP Address</TableHead>
                    <TableHead className="text-right font-bold">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reportData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                          No records found for selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData.map((r, i) => (
                        <TableRow key={i} className="hover:bg-muted/5">
                          <TableCell className="font-medium text-sm">{formatDate(r.date)}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{r.employee?.full_name}</div>
                            <div className="text-[10px] text-muted-foreground">{r.employee?.department}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">{fmtTime(r.clock_in)}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{fmtTime(r.clock_out)}</TableCell>
                          <TableCell className="text-center font-mono text-[10px] text-muted-foreground">{r.ip_address || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={r.isOnLeave ? "outline" : "secondary"}
                              className={cn(
                                "px-2 py-0.5 text-[10px] font-bold",
                                r.isOnLeave && "bg-orange-500/10 text-orange-600 border-orange-500/20"
                              )}
                            >
                              {r.isOnLeave ? "ON LEAVE" : (r.clock_out ? "PRESENT" : "ACTIVE")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
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
                    <FlatDatePicker date={newHDate} onChange={setNewHDate} placeholder="Choose holiday date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Holiday Name</Label>
                    <Input placeholder="e.g. Eid-ul-Fitr" value={newHName} onChange={e => setNewHName(e.target.value)} className="rounded-xl h-10" />
                  </div>
                  <Button className="w-full rounded-xl shadow-md h-10 font-bold" onClick={addHoliday}>
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
                    <SelectTrigger className="h-10 rounded-xl shadow-sm"><SelectValue /></SelectTrigger>
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

                <Button className="w-full rounded-xl shadow-md h-11 font-bold bg-primary hover:bg-primary/90" onClick={saveSettings}>
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
                <div className="overflow-x-auto px-5">
                  <Table>
                    <TableHeader className="bg-muted/30"><TableRow>
                      <TableHead className="font-bold">Employee</TableHead>
                      <TableHead className="font-bold">Registered Device</TableHead>
                      <TableHead className="text-right font-bold">Action</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {employees.map(e => (
                        <TableRow key={e.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="font-medium text-sm">{e.full_name}</TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground">{e.registered_device_id ? e.registered_device_id.slice(0, 12) + "..." : "No device bound"}</TableCell>
                          <TableCell className="text-right">
                            {e.registered_device_id ? (
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => resetDevice(e.id)}>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-muted/5">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Holiday & Leave Calendar
          </CardTitle>
          <CardDescription>Visual overview of team presence and holidays.</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold mr-4">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" className="h-8 px-3 text-xs font-bold rounded-none border-r" onClick={goToToday}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-r last:border-r-0">
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
                  "min-h-[100px] p-2 border-r border-b last:border-r-0 transition-colors",
                  !isCurrentMonth && "bg-muted/10 opacity-40",
                  isTodayDate && "bg-primary/5",
                  isWeekend && !isTodayDate && isCurrentMonth && "bg-muted/5"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                    isTodayDate && "bg-primary text-primary-foreground shadow-sm"
                  )}>
                    {format(d, "d")}
                  </span>
                </div>

                <div className="space-y-1 overflow-hidden">
                  {isFriday && isCurrentMonth && (
                    <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-muted-foreground border border-muted-foreground/20 truncate">
                      🏠 Weekend
                    </div>
                  )}
                  {hols.map((h, idx) => (
                    <div key={`h-${idx}`} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20 truncate" title={h.name}>
                      ⭐ {h.name}
                    </div>
                  ))}
                  {lvs.map((l, idx) => {
                    const emp = employees.find(e => e.id === l.employee_id);
                    return (
                      <div key={`l-${idx}`} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 truncate" title={`${emp?.full_name}: ${l.reason}`}>
                        👤 {emp?.full_name?.split(' ')[0]}
                      </div>
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
