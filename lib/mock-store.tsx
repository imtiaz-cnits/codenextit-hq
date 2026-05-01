"use client";

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "./auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
}

export interface AttendanceEntry {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
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
  setRole: (userId: string, role: string, active: boolean) => Promise<void>;
}

const MockCtx = createContext<(MockState & MockActions) | null>(null);

const uid = () => Math.random().toString(36).slice(2, 11);
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

export function MockProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const t = todayStr();

  // --- Supabase Queries ---

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", user?.id],
    queryFn: async () => {
      let query = supabase.from("employees").select("*").order("full_name");
      const { data, error } = await query;
      if (error) throw error;
      const self = (data || []).find(e => e.profile_id === user?.id);
      setCurrentEmployee(self || null);
      return (data || []) as Employee[];
    },
    enabled: !!user,
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["attendance", t, currentEmployee?.id],
    queryFn: async () => {
      let query = supabase.from("attendance").select("*").eq("date", t);
      if (!isSuperAdmin && currentEmployee) {
        query = query.eq("employee_id", currentEmployee.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AttendanceEntry[];
    },
    enabled: !!user && (isSuperAdmin || !!currentEmployee),
  });

  // --- Supabase Mutations ---

  const addEmployeeMutation = useMutation({
    mutationFn: async (newEmp: Omit<Employee, "id">) => {
      const { data, error } = await supabase
        .from("employees")
        .insert([newEmp])
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
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) throw error;
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
      const existing = attendance.find((a) => a.employee_id === empId);
      if (!existing) {
        const { error } = await supabase.from("attendance").insert([
          { employee_id: empId, date: t, clock_in: nowIso() },
        ]);
        if (error) throw error;
      } else if (!existing.clock_out) {
        const { error } = await supabase
          .from("attendance")
          .update({ clock_out: nowIso() })
          .eq("id", existing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // --- Remaining Mock States ---
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vault, setVault] = useState<VaultFile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

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
  const markNotificationRead = useCallback((id: string) => {}, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const setRole = async (userId: string, role: string, active: boolean) => {
    if (active) {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    }
    toast.success(`Role ${active ? "granted" : "removed"}`);
  };

  return (
    <MockCtx.Provider
      value={{
        employees, attendance, leaves, payrolls, quotations, invoices, expenses, vault, notifications,
        projects, tasks,
        loading: loadingEmployees || loadingAttendance,
        addEmployee: (e) => addEmployeeMutation.mutate(e),
        updateEmployee: (id, patch) => updateEmployeeMutation.mutate({ id, patch }),
        removeEmployee: (id) => removeEmployeeMutation.mutate(id),
        toggleClock: (id) => toggleClockMutation.mutate(id),
        addLeave, setLeaveStatus,
        addPayroll, setPayrollStatus,
        addQuotation, addInvoice, updateInvoiceStatus,
        addExpense, addVaultFile,
        markNotificationRead, markAllNotificationsRead,
        setRole,
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
