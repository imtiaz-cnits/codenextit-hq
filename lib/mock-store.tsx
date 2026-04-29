"use client";

/**
 * Local mock store for modules not yet persisted (HR ops, payroll, finance docs, vault, attendance, leave).
 * Survives in-app navigation; resets on full reload (acceptable for shell MVP).
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ------------ Types ------------
export interface Employee {
  id: string;
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
  month: string; // YYYY-MM
  base: number;
  bonus: number;
  deduction: number;
  net: number;
  status: "draft" | "paid";
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
}

const MockCtx = createContext<(MockState & MockActions) | null>(null);

const uid = () => Math.random().toString(36).slice(2, 11);
const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

// ------------ Seed data ------------
const seedEmployees: Employee[] = [
  {
    id: "emp-1",
    full_name: "Tanvir Ahmed",
    email: "tanvir@codenext.io",
    designation: "Senior Full-Stack Developer",
    department: "Engineering",
    phone: "+880 1711 234567",
    blood_group: "B+",
    emergency_contact: "Salma Ahmed +880 1711 999000",
    joined_at: "2022-03-14",
    base_salary: 95000,
  },
  {
    id: "emp-2",
    full_name: "Nadia Rahman",
    email: "nadia@codenext.io",
    designation: "Lead UI/UX Designer",
    department: "Design",
    phone: "+880 1721 334455",
    blood_group: "O+",
    emergency_contact: "Fahim Rahman +880 1721 998877",
    joined_at: "2022-08-02",
    base_salary: 85000,
  },
  {
    id: "emp-3",
    full_name: "Rakib Hasan",
    email: "rakib@codenext.io",
    designation: "Technical SEO Specialist",
    department: "SEO",
    phone: "+880 1731 776655",
    blood_group: "A+",
    emergency_contact: "Maya Hasan +880 1731 112233",
    joined_at: "2023-01-19",
    base_salary: 65000,
  },
  {
    id: "emp-4",
    full_name: "Sumaiya Karim",
    email: "sumaiya@codenext.io",
    designation: "WordPress Developer",
    department: "Engineering",
    phone: "+880 1741 998877",
    blood_group: "AB+",
    emergency_contact: "Imran Karim +880 1741 445566",
    joined_at: "2023-05-22",
    base_salary: 55000,
  },
  {
    id: "emp-5",
    full_name: "Mahir Chowdhury",
    email: "mahir@codenext.io",
    designation: "Project Manager",
    department: "Management",
    phone: "+880 1751 887766",
    blood_group: "B-",
    emergency_contact: "Rina Chowdhury +880 1751 223344",
    joined_at: "2021-11-08",
    base_salary: 110000,
  },
  {
    id: "emp-6",
    full_name: "Ayesha Siddika",
    email: "ayesha@codenext.io",
    designation: "QA Engineer",
    department: "Engineering",
    phone: "+880 1761 776543",
    blood_group: "O-",
    emergency_contact: "Kamal Siddik +880 1761 445566",
    joined_at: "2023-09-10",
    base_salary: 60000,
  },
  {
    id: "emp-7",
    full_name: "Farhan Iqbal",
    email: "farhan@codenext.io",
    designation: "Laravel Developer",
    department: "Engineering",
    phone: "+880 1771 665544",
    blood_group: "A-",
    emergency_contact: "Sabina Iqbal +880 1771 332211",
    joined_at: "2022-12-01",
    base_salary: 75000,
  },
  {
    id: "emp-8",
    full_name: "Tasnia Akter",
    email: "tasnia@codenext.io",
    designation: "Content & GEO Strategist",
    department: "SEO",
    phone: "+880 1781 554433",
    blood_group: "B+",
    emergency_contact: "Rafi Akter +880 1781 998877",
    joined_at: "2024-02-15",
    base_salary: 50000,
  },
];

const seedQuotations: Quotation[] = [
  { id: "q-1", number: "QT-2025-0142", client_name: "Daffodil Mart Ltd", amount: 480000, currency: "BDT", status: "sent", date: "2025-04-12", valid_until: "2025-05-12" },
  { id: "q-2", number: "QT-2025-0143", client_name: "Nordic SaaS AB", amount: 12500, currency: "USD", status: "accepted", date: "2025-04-10", valid_until: "2025-05-10" },
  { id: "q-3", number: "QT-2025-0144", client_name: "GreenLeaf Pharma", amount: 220000, currency: "BDT", status: "draft", date: "2025-04-18", valid_until: "2025-05-18" },
  { id: "q-4", number: "QT-2025-0145", client_name: "Atlas FinTech", amount: 8800, currency: "USD", status: "rejected", date: "2025-03-28", valid_until: "2025-04-28" },
];

const seedInvoices: Invoice[] = [
  {
    id: "inv-1", number: "INV-2025-0312", client_name: "Daffodil Mart Ltd",
    amount: 240000, paid: 240000, currency: "BDT", status: "paid",
    issued_at: "2025-04-01", due_at: "2025-04-15",
    items: [{ description: "MERN e-commerce phase 1", quantity: 1, rate: 240000 }],
  },
  {
    id: "inv-2", number: "INV-2025-0313", client_name: "Nordic SaaS AB",
    amount: 6250, paid: 3125, currency: "USD", status: "partial",
    issued_at: "2025-04-05", due_at: "2025-04-20",
    items: [
      { description: "Technical SEO audit", quantity: 1, rate: 2500 },
      { description: "Schema markup implementation", quantity: 15, rate: 250 },
    ],
  },
  {
    id: "inv-3", number: "INV-2025-0314", client_name: "GreenLeaf Pharma",
    amount: 110000, paid: 0, currency: "BDT", status: "overdue",
    issued_at: "2025-03-15", due_at: "2025-03-30",
    items: [{ description: "WordPress redesign", quantity: 1, rate: 110000 }],
  },
  {
    id: "inv-4", number: "INV-2025-0315", client_name: "Atlas FinTech",
    amount: 4400, paid: 0, currency: "USD", status: "sent",
    issued_at: "2025-04-15", due_at: "2025-05-01",
    items: [{ description: "GEO content strategy retainer (Apr)", quantity: 1, rate: 4400 }],
  },
  {
    id: "inv-5", number: "INV-2025-0316", client_name: "Sundarban Travels",
    amount: 65000, paid: 0, currency: "BDT", status: "draft",
    issued_at: "2025-04-20", due_at: "2025-05-05",
    items: [{ description: "Booking module sprint", quantity: 1, rate: 65000 }],
  },
];

const seedExpenses: Expense[] = [
  { id: "ex-1", category: "Office Rent", description: "Banani office April rent", amount: 85000, currency: "BDT", date: "2025-04-01", vendor: "Banani Properties" },
  { id: "ex-2", category: "Software", description: "GitHub Team plan", amount: 64, currency: "USD", date: "2025-04-03", vendor: "GitHub" },
  { id: "ex-3", category: "Software", description: "Vercel Pro", amount: 20, currency: "USD", date: "2025-04-05", vendor: "Vercel" },
  { id: "ex-4", category: "Software", description: "AWS hosting", amount: 312, currency: "USD", date: "2025-04-07", vendor: "AWS" },
  { id: "ex-5", category: "SEO Tools", description: "Ahrefs Standard", amount: 199, currency: "USD", date: "2025-04-08", vendor: "Ahrefs" },
  { id: "ex-6", category: "Utility", description: "Electricity bill", amount: 12500, currency: "BDT", date: "2025-04-10", vendor: "DESCO" },
  { id: "ex-7", category: "Software", description: "Figma org", amount: 90, currency: "USD", date: "2025-04-12", vendor: "Figma" },
];

const seedVault: VaultFile[] = [
  { id: "v-1", name: "Daffodil_Brand_Guidelines.pdf", client_name: "Daffodil Mart Ltd", type: "logo", size_kb: 2400, uploaded_at: "2025-03-12", uploaded_by: "Nadia Rahman" },
  { id: "v-2", name: "Nordic_SaaS_SRS_v2.docx", client_name: "Nordic SaaS AB", type: "srs", size_kb: 880, uploaded_at: "2025-03-22", uploaded_by: "Mahir Chowdhury" },
  { id: "v-3", name: "GreenLeaf_API_v1.yaml", client_name: "GreenLeaf Pharma", type: "api_doc", size_kb: 124, uploaded_at: "2025-04-02", uploaded_by: "Farhan Iqbal" },
  { id: "v-4", name: "Atlas_Logo_Pack.zip", client_name: "Atlas FinTech", type: "logo", size_kb: 5600, uploaded_at: "2025-04-08", uploaded_by: "Nadia Rahman" },
  { id: "v-5", name: "Sundarban_Wireframes.fig", client_name: "Sundarban Travels", type: "design", size_kb: 14200, uploaded_at: "2025-04-14", uploaded_by: "Nadia Rahman" },
];

const seedLeaves: LeaveRequest[] = [
  { id: "lv-1", employee_id: "emp-3", type: "sick", from_date: "2025-04-22", to_date: "2025-04-23", reason: "Fever", status: "approved", created_at: "2025-04-21T09:00:00Z" },
  { id: "lv-2", employee_id: "emp-4", type: "casual", from_date: "2025-04-25", to_date: "2025-04-25", reason: "Family event", status: "pending", created_at: "2025-04-23T11:00:00Z" },
  { id: "lv-3", employee_id: "emp-7", type: "annual", from_date: "2025-05-05", to_date: "2025-05-09", reason: "Vacation", status: "pending", created_at: "2025-04-22T14:00:00Z" },
];

const seedPayrolls: PayrollRun[] = seedEmployees.slice(0, 5).map((e, i) => ({
  id: `pr-${i + 1}`,
  employee_id: e.id,
  month: "2025-03",
  base: e.base_salary,
  bonus: i === 0 ? 5000 : 0,
  deduction: i === 2 ? 2000 : 0,
  net: e.base_salary + (i === 0 ? 5000 : 0) - (i === 2 ? 2000 : 0),
  status: "paid",
}));

const seedAttendance: AttendanceEntry[] = seedEmployees.slice(0, 5).map((e) => ({
  id: `at-${e.id}`,
  employee_id: e.id,
  date: today(),
  clock_in: `${today()}T09:${String(Math.floor(Math.random() * 30)).padStart(2, "0")}:00`,
  clock_out: null,
}));

const seedNotifications: Notification[] = [
  { id: "n-1", title: "SSL expiring soon", body: "daffodilmart.com SSL expires in 12 days", read: false, type: "warning", created_at: nowIso() },
  { id: "n-2", title: "Invoice paid", body: "Daffodil Mart Ltd paid INV-2025-0312", read: false, type: "success", created_at: nowIso() },
  { id: "n-3", title: "New ticket", body: "Atlas FinTech opened a Critical ticket", read: false, type: "error", created_at: nowIso() },
  { id: "n-4", title: "Leave request", body: "Sumaiya requested casual leave", read: true, type: "info", created_at: nowIso() },
];

export function MockProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(seedAttendance);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(seedLeaves);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>(seedPayrolls);
  const [quotations, setQuotations] = useState<Quotation[]>(seedQuotations);
  const [invoices, setInvoices] = useState<Invoice[]>(seedInvoices);
  const [expenses, setExpenses] = useState<Expense[]>(seedExpenses);
  const [vault, setVault] = useState<VaultFile[]>(seedVault);
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);

  const addEmployee = useCallback((e: Omit<Employee, "id">) => {
    setEmployees((prev) => [...prev, { ...e, id: uid() }]);
  }, []);
  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);
  const removeEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const toggleClock = useCallback((employeeId: string) => {
    const t = today();
    setAttendance((prev) => {
      const existing = prev.find((a) => a.employee_id === employeeId && a.date === t);
      if (!existing) {
        return [
          ...prev,
          { id: uid(), employee_id: employeeId, date: t, clock_in: nowIso(), clock_out: null },
        ];
      }
      if (!existing.clock_out) {
        return prev.map((a) => (a.id === existing.id ? { ...a, clock_out: nowIso() } : a));
      }
      return prev;
    });
  }, []);

  const addLeave = useCallback((l: Omit<LeaveRequest, "id" | "created_at" | "status">) => {
    setLeaves((prev) => [
      { ...l, id: uid(), status: "pending", created_at: nowIso() },
      ...prev,
    ]);
  }, []);
  const setLeaveStatus = useCallback((id: string, status: LeaveRequest["status"]) => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  }, []);

  const addPayroll = useCallback((p: Omit<PayrollRun, "id" | "net">) => {
    setPayrolls((prev) => [
      { ...p, id: uid(), net: p.base + p.bonus - p.deduction },
      ...prev,
    ]);
  }, []);
  const setPayrollStatus = useCallback((id: string, status: PayrollRun["status"]) => {
    setPayrolls((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const addQuotation = useCallback((q: Omit<Quotation, "id">) => {
    setQuotations((prev) => [{ ...q, id: uid() }, ...prev]);
  }, []);
  const addInvoice = useCallback((i: Omit<Invoice, "id">) => {
    setInvoices((prev) => [{ ...i, id: uid() }, ...prev]);
  }, []);
  const updateInvoiceStatus = useCallback((id: string, status: Invoice["status"], paid?: number) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status, paid: paid ?? i.paid } : i))
    );
  }, []);

  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    setExpenses((prev) => [{ ...e, id: uid() }, ...prev]);
  }, []);

  const addVaultFile = useCallback((f: Omit<VaultFile, "id">) => {
    setVault((prev) => [{ ...f, id: uid() }, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <MockCtx.Provider
      value={{
        employees, attendance, leaves, payrolls, quotations, invoices, expenses, vault, notifications,
        addEmployee, updateEmployee, removeEmployee,
        toggleClock,
        addLeave, setLeaveStatus,
        addPayroll, setPayrollStatus,
        addQuotation, addInvoice, updateInvoiceStatus,
        addExpense, addVaultFile,
        markNotificationRead, markAllNotificationsRead,
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
