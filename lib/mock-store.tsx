"use client";

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "./auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toLocalDateString } from "./format";

// ------------ Types ------------
export interface Employee {
  id: string;
  employee_code?: string;
  full_name: string;
  email: string;
  designation: string;
  department: string;
  phone: string;
  blood_group: string;
  emergency_contact: string;
  joined_at: string;
  base_salary: number;
  registered_device_id?: string;
  profile_id?: string;
  avatar_url?: string | null;
  office_start?: string;
  office_end?: string;
}

export interface AttendanceEntry {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  device_id?: string;
  ip_address?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: "sick" | "casual" | "annual";
  from_date: string;
  to_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface PayrollRun {
  id: string;
  employee_id: string;
  month: string;
  base: number;
  bonus: number;
  deduction: number;
  net: number;
  status: "draft" | "paid";
}
export interface Project {
  id: string; name: string; description: string | null; client_id: string | null;
  budget: number; deadline: string | null; status: string; category: string;
  currency: "BDT" | "USD"; progress: number; team_members?: string[];
}
export interface Task {
  id: string; project_id: string; title: string; status: string;
  priority: string; assignee_id: string | null; due_date: string | null;
}

export interface Quotation {
  id: string;
  number: string;
  client_name: string;
  client_id?: string;
  amount: number;
  currency: "BDT" | "USD";
  status: "draft" | "sent" | "accepted" | "rejected";
  date: string;
  valid_until: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  client_name: string;
  client_id?: string;
  amount: number;
  paid: number;
  currency: "BDT" | "USD";
  status: "draft" | "sent" | "paid" | "partial" | "overdue";
  issued_at: string;
  due_at: string;
  items: InvoiceLineItem[];
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: "BDT" | "USD";
  date: string;
  vendor: string;
}

export interface VaultFile {
  id: string;
  name: string;
  client_name: string;
  type: "logo" | "srs" | "api_doc" | "design" | "other";
  size_kb: number;
  uploaded_at: string;
  uploaded_by: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  type: "info" | "warning" | "success" | "error";
}

export interface Client {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  ltv: number;
  currency: "BDT" | "USD";
}

export interface InfrastructureAsset {
  id: string;
  name: string;
  asset_type: "domain" | "ssl" | "hosting" | "vps" | "subscription";
  expires_at: string | null;
  cost: number;
  currency: "BDT" | "USD";
  client_id: string | null;
}

interface MockState {
  employees: Employee[];
  attendance: AttendanceEntry[];
  leaves: LeaveRequest[];
  payrolls: PayrollRun[];
  quotations: Quotation[];
  invoices: Invoice[];
  expenses: Expense[];
  vault: VaultFile[];
  notifications: Notification[];
  projects: Project[];
  tasks: Task[];
  clients: Client[];
  infrastructure: InfrastructureAsset[];
  currentEmployee: Employee | null;
  loading: boolean;
}

interface MockActions {
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  removeEmployee: (id: string) => void;
  toggleClock: (employeeId: string) => void;
  addLeave: (l: Omit<LeaveRequest, "id" | "created_at" | "status">) => void;
  setLeaveStatus: (id: string, status: LeaveRequest["status"]) => void;
  addPayroll: (p: Omit<PayrollRun, "id" | "net">) => void;
  setPayrollStatus: (id: string, status: PayrollRun["status"]) => void;
  addQuotation: (q: Omit<Quotation, "id">) => void;
  addInvoice: (i: Omit<Invoice, "id">) => void;
  updateInvoiceStatus: (id: string, status: Invoice["status"], paid?: number) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  addVaultFile: (f: Omit<VaultFile, "id">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (userId: string, n: { title: string; body: string; type?: Notification["type"] }) => Promise<void>;
  notifyAdmins: (n: { title: string; body: string; type?: Notification["type"] }) => Promise<void>;
  setRole: (userId: string, role: string, active: boolean) => Promise<void>;
  updateAttendance: (id: string, patch: Partial<AttendanceEntry>) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  addManualAttendance: (employeeId: string, date: string, clockIn: string, clockOut: string | null) => Promise<void>;
}

const MockCtx = createContext<(MockState & MockActions) | null>(null);

const uid = () => Math.random().toString(36).slice(2, 11);
const todayStr = () => toLocalDateString();
const nowIso = () => new Date().toISOString();

export function MockProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, hasRole, profile } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const t = todayStr();

  // --- Supabase Queries ---

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", user?.id],
    queryFn: async () => {
      // Fetch both tables to ensure data is in sync
      const [{ data: empData, error }, { data: profData }] = await Promise.all([
        supabase.from("employees").select("*").order("full_name"),
        supabase.from("profiles").select("id, email, avatar_url, full_name")
      ]);

      if (error) throw error;

      // Merge profile data (like avatar) into employee records
      const data = (empData || []).map((emp: any) => {
        const profile = (profData || []).find(p => 
          p.id === emp.profile_id || 
          (p.email && emp.email && p.email.toLowerCase() === emp.email.toLowerCase())
        );
        return {
          ...emp,
          avatar_url: profile?.avatar_url || emp.avatar_url,
          profile_id: emp.profile_id || profile?.id
        };
      });
      
      // Try to find self by profile_id first, then fallback to email
      const selfByProfile = (data || []).find((e: any) => e.profile_id === user?.id);
      const selfByEmail = (data || []).find((e: any) => e.email === user?.email);
      const self = selfByProfile || selfByEmail;

      // Auto-link profile_id if missing but email matches
      if (self && !(self as any).profile_id && user?.id) {
        console.log("Auto-linking employee record to profile:", (self as any).id, user.id);
        void supabase.from("employees").update({ profile_id: user.id }).eq("id", (self as any).id);
        (self as any).profile_id = user.id;
      }
      
      setCurrentEmployee((self as any) || null);
      return data as any;
    },
    enabled: !!user,
  });

  // Auto-create employee record for Super Admin if missing
  useEffect(() => {
    const shouldCreate = 
      !loadingEmployees && 
      user && 
      isSuperAdmin && 
      !currentEmployee;

    if (shouldCreate) {
      console.log("Super Admin detected without employee record. Creating one...");
      const newEmp: Omit<Employee, "id"> = {
        full_name: profile?.full_name || user.email?.split('@')[0] || "Super Admin",
        email: user.email!,
        designation: profile?.designation || "Super Admin",
        department: "Management",
        phone: "",
        blood_group: "Unknown",
        emergency_contact: "",
        joined_at: new Date().toISOString().split('T')[0],
        base_salary: 0,
        profile_id: user.id,
        office_start: "09:00",
        office_end: "18:00"
      };
      
      void supabase.from("employees").insert([newEmp] as any).then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["employees"] });
        } else {
          console.error("Failed to auto-create employee record:", error);
        }
      });
    }
  }, [loadingEmployees, user, isSuperAdmin, currentEmployee, profile, employees, queryClient]);

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["attendance", currentEmployee?.id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase.from("attendance").select("*").order("date", { ascending: false });
      if (!isSuperAdmin && currentEmployee) {
        query = query.eq("employee_id", currentEmployee.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AttendanceEntry[];
    },
    enabled: !!user && (isSuperAdmin || !!currentEmployee),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const { data: leaves = [], isLoading: loadingLeaves } = useQuery({
    queryKey: ["leaves", currentEmployee?.id],
    queryFn: async () => {
      let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (!isSuperAdmin && currentEmployee) {
        query = query.eq("employee_id", currentEmployee.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(l => ({
        ...l,
        type: l.type as any,
        status: l.status as any,
      })) as LeaveRequest[];
    },
    enabled: !!user && (isSuperAdmin || !!currentEmployee),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("company_name");
      if (error) throw error;
      return (data || []) as Client[];
    },
    enabled: !!user && isSuperAdmin,
  });

  const { data: infrastructure = [], isLoading: loadingInfra } = useQuery({
    queryKey: ["infrastructure"],
    queryFn: async () => {
      const { data, error } = await supabase.from("infrastructure_assets").select("*").order("expires_at");
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user && isSuperAdmin,
  });

  const { data: notifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user,
  });

  const addNotification = async (userId: string, n: { title: string; body: string; type?: Notification["type"] }) => {
    await supabase.from("notifications").insert({
      user_id: userId,
      title: n.title,
      body: n.body,
      type: n.type || "info",
    });
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  const notifyAdmins = async (n: { title: string; body: string; type?: Notification["type"] }) => {
    const { data: admins } = await supabase.from("user_roles" as any).select("user_id").eq("role", "super_admin");
    if (admins) {
      for (const a of admins) {
        await addNotification((a as any).user_id, n);
      }
    }
  };

  // --- Supabase Mutations ---

  const addEmployeeMutation = useMutation({
    mutationFn: async (newEmp: Omit<Employee, "id">) => {
      const { data, error } = await supabase
        .from("employees")
        .insert([newEmp] as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee added successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Employee> }) => {
      const { data: emp } = await supabase.from("employees").select("profile_id").eq("id", id).maybeSingle();
      const { error } = await (supabase.from("employees") as any).update(patch).eq("id", id);
      if (error) throw error;

      // Sync key fields to profile table if profile_id exists
      if (emp?.profile_id && (patch.avatar_url || patch.full_name || patch.designation)) {
        await supabase.from("profiles").update({
          avatar_url: patch.avatar_url,
          full_name: patch.full_name,
          designation: patch.designation
        }).eq("id", emp.profile_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleClockMutation = useMutation({
    mutationFn: async (empId: string) => {
      // 1. Get/Create Device ID
      let deviceId = localStorage.getItem("cnit_device_id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("cnit_device_id", deviceId);
      }

      // 2. Get IP Address
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const d = await res.json();
        ip = d.ip;
      } catch (e) {
        console.error("IP detection failed", e);
      }

      // 3. Verify Device (Skip for Super Admins)
      const emp = employees.find((e: any) => e.id === empId);
      if (!isSuperAdmin && emp?.registered_device_id && emp.registered_device_id !== deviceId) {
        throw new Error("Device Mismatch! You can only give attendance from your registered device.");
      }

      // 4. Register device if not already set (Skip for Super Admins)
      if (!isSuperAdmin && emp && !emp.registered_device_id) {
        const { error: regErr } = await (supabase.from("employees") as any).update({ registered_device_id: deviceId }).eq("id", empId);
        if (regErr) console.error("Could not register device", regErr);
      }

      // 5. Toggle status
      const existing = attendance.find((a: any) => a.employee_id === empId && a.date === todayStr());
      const isClockOut = !!(existing && !existing.clock_out);
      
      const { error: clockError } = await (supabase.from("attendance") as any).upsert({
        id: existing?.id || crypto.randomUUID(),
        employee_id: empId,
        date: todayStr(),
        clock_in: existing?.clock_in || nowIso(),
        clock_out: isClockOut ? nowIso() : null,
        ip_address: ip,
        device_id: deviceId
      });
      if (clockError) throw clockError;

      // 6. Notify targeted employee (and admin if acting on self)
      const targetProfileId = emp?.profile_id || user!.id;
      await addNotification(targetProfileId, {
        title: isClockOut ? "Clocked Out" : "Clocked In",
        body: isSuperAdmin && targetProfileId !== user!.id 
          ? `An administrator has ${isClockOut ? "clocked you out" : "clocked you in"} at ${new Date().toLocaleTimeString()}.`
          : (isClockOut ? `Good work today! You clocked out at ${new Date().toLocaleTimeString()}.` : `Welcome! You clocked in at ${new Date().toLocaleTimeString()}.`),
        type: "success"
      });

      // 7. Notify Admins (only if a regular staff performed the action)
      if (!isSuperAdmin) {
        await notifyAdmins({
          title: isClockOut ? "Staff Clocked Out" : "Staff Clocked In",
          body: `${emp?.full_name || "An employee"} just ${isClockOut ? "clocked out" : "clocked in"}.`,
          type: "info"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AttendanceEntry> }) => {
      const { error } = await supabase.from("attendance").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance record removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addManualAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, date, clockIn, clockOut }: { employeeId: string; date: string; clockIn: string; clockOut: string | null }) => {
      const { error } = await supabase.from("attendance").insert({
        employee_id: employeeId,
        date,
        clock_in: clockIn,
        clock_out: clockOut,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance entry added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addLeaveMutation = useMutation({
    mutationFn: async (l: any) => {
      const { error } = await supabase.from("leave_requests").insert(l);
      if (error) throw error;

      // Notify Admins
      await notifyAdmins({
        title: "New Leave Request",
        body: `${currentEmployee?.full_name || user?.email} has requested a ${l.type} leave.`,
        type: "info"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave request submitted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const setLeaveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveRequest["status"] }) => {
      const { data: leave } = await supabase.from("leave_requests").select("employee_id").eq("id", id).maybeSingle();
      const { error } = await supabase.from("leave_requests").update({ 
        status, 
        approved_at: status !== "pending" ? nowIso() : null 
      }).eq("id", id);
      if (error) throw error;

      // Notify Employee
      if (leave && (leave as any).employee_id) {
        const { data: emp } = await supabase.from("employees").select("profile_id").eq("id", (leave as any).employee_id).maybeSingle();
        if (emp?.profile_id) {
          await addNotification(emp.profile_id, {
            title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Your leave request has been ${status}.`,
            type: status === "approved" ? "success" : "error"
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success("Leave status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // --- Remaining Mock States ---
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vault, setVault] = useState<VaultFile[]>([]);

  // ... Mock Actions for non-persisted modules ...
  const addLeave = useCallback((l: any) => {}, []);
  const setLeaveStatus = useCallback((id: string, status: any) => {}, []);
  const addPayroll = useCallback((p: any) => {}, []);
  const setPayrollStatus = useCallback((id: string, status: any) => {}, []);
  const addQuotation = useCallback((q: any) => {}, []);
  const addInvoice = useCallback((i: any) => {}, []);
  const updateInvoiceStatus = useCallback((id: string, status: any, paid?: number) => {}, []);
  const addExpense = useCallback((e: any) => {}, []);
  const addVaultFile = useCallback((f: any) => {}, []);
  const markNotificationRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }, [user]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  }, [user]);

  const setRole = async (userId: string, role: string, active: boolean) => {
    if (active) {
      await (supabase.from("user_roles") as any).insert({ user_id: userId, role });
    } else {
      await (supabase.from("user_roles") as any).delete().eq("user_id", userId).eq("role", role);
    }
    toast.success(`Role ${active ? "granted" : "removed"}`);
  };

  return (
    <MockCtx.Provider
      value={{
        employees, attendance, leaves, payrolls, quotations, invoices, expenses, vault, notifications,
        projects, tasks, clients, infrastructure, currentEmployee,
        loading: loadingEmployees || loadingAttendance || loadingProjects || loadingTasks || loadingLeaves || loadingClients || loadingInfra || loadingNotifs,
        addEmployee: (e) => addEmployeeMutation.mutate(e),
        updateEmployee: (id, patch) => updateEmployeeMutation.mutate({ id, patch }),
        removeEmployee: (id) => removeEmployeeMutation.mutate(id),
        toggleClock: (id) => toggleClockMutation.mutate(id),
        addLeave: (l) => addLeaveMutation.mutate(l),
        setLeaveStatus: (id, status) => setLeaveStatusMutation.mutate({ id, status }),
        addPayroll, setPayrollStatus,
        addQuotation, addInvoice, updateInvoiceStatus,
        addExpense, addVaultFile,
        markNotificationRead, markAllNotificationsRead, addNotification, notifyAdmins,
        setRole,
        updateAttendance: (id, patch) => updateAttendanceMutation.mutateAsync({ id, patch }),
        deleteAttendance: (id) => deleteAttendanceMutation.mutateAsync(id),
        addManualAttendance: (employeeId, date, clockIn, clockOut) => addManualAttendanceMutation.mutateAsync({ employeeId, date, clockIn, clockOut }),
      }}
    >
      {children}
    </MockCtx.Provider>
  );
}

export function useMock() {
  const ctx = useContext(MockCtx);
  if (!ctx) throw new Error("useMock must be used within MockProvider");
  return ctx;
}
