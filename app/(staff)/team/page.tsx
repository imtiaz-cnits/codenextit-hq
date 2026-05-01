"use client";

import { useState } from "react";
import { useMock, type Employee } from "../../../lib/mock-store";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "../../../components/ui/dropdown-menu";
import { 
  Plus, Phone, Mail, Heart, Search, MoreVertical, Edit, Trash2, Eye, 
  ShieldAlert, Briefcase, Calendar, Banknote, Shield 
} from "lucide-react";
import { initials, avatarColor, formatCurrency, formatDate } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import { supabase } from "../../../integrations/supabase/client";

const DEPARTMENTS = ["All", "Engineering", "Design", "SEO", "Management"];

export default function TeamPage() {
  const { employees, addEmployee, updateEmployee, removeEmployee, setRole, loading } = useMock();
  const { hasRole } = useAuth();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [managingRole, setManagingRole] = useState<Employee | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  if (loading) {
    return <div className="h-[400px] flex items-center justify-center text-muted-foreground animate-pulse">Loading directory...</div>;
  }

  const filtered = employees.filter((e) => {
    const matchQ = !q || `${e.full_name} ${e.email} ${e.designation}`.toLowerCase().includes(q.toLowerCase());
    const matchD = dept === "All" || e.department === dept;
    return matchQ && matchD;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Directory</h1>
          <p className="text-muted-foreground mt-1">{employees.length} people across {new Set(employees.map((e) => e.department)).size} departments.</p>
        </div>
        <EmployeeSheet 
          mode="create" 
          onSubmit={(data) => addEmployee(data)} 
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, role..." className="pl-9" />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((e) => (
          <Card 
            key={e.id} 
            className="group relative hover:shadow-elegant transition-all cursor-pointer border-transparent hover:border-primary/20"
            onClick={() => setSelectedEmp(e)}
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); setSelectedEmp(e); }}>
                    <Eye className="h-4 w-4 mr-2" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); setEditingEmp(e); }}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Employee
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={(ev) => { ev.stopPropagation(); removeEmployee(e.id); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                  {hasRole("super_admin") && (
                    <DropdownMenuItem onClick={async (ev) => { 
                      ev.stopPropagation(); 
                      // Find user ID by email
                      const { data } = await supabase.from("profiles").select("id").eq("email", e.email).maybeSingle();
                      if (data) {
                        setUserId(data.id);
                        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.id);
                        setUserRoles((roles || []).map(r => r.role));
                        setManagingRole(e);
                      } else {
                        toast.error("This employee doesn't have a user account yet.");
                      }
                    }}>
                      <Shield className="h-4 w-4 mr-2" /> Manage Access
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarFallback className={cn("text-white", avatarColor(e.full_name))}>
                    {initials(e.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{e.full_name}</CardTitle>
                  <CardDescription className="text-xs truncate font-medium">{e.designation}</CardDescription>
                  <Badge variant="secondary" className="mt-1.5 text-[10px] h-5">{e.department}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-primary/60" />{e.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-primary/60" />{e.phone}</div>
              <div className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 shrink-0 text-destructive/60" /> {e.blood_group} · joined {formatDate(e.joined_at)}</div>
              <div className="text-foreground font-semibold pt-2 border-t mt-2 flex justify-between items-center">
                <span>{formatCurrency(e.base_salary, "BDT")}/mo</span>
                <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">ID: {e.employee_code || e.id.slice(0, 8)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={(o) => !o && setSelectedEmp(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedEmp && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16 border-4 border-muted">
                    <AvatarFallback className={cn("text-xl text-white", avatarColor(selectedEmp.full_name))}>
                      {initials(selectedEmp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">{selectedEmp.full_name}</DialogTitle>
                    <DialogDescription className="text-base font-medium text-primary">
                      {selectedEmp.designation}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 py-4">
                <InfoItem icon={Mail} label="Email Address" value={selectedEmp.email} />
                <InfoItem icon={Phone} label="Phone Number" value={selectedEmp.phone} />
                <InfoItem icon={Briefcase} label="Department" value={selectedEmp.department} />
                <InfoItem icon={Calendar} label="Joining Date" value={formatDate(selectedEmp.joined_at)} />
                <InfoItem icon={Heart} label="Blood Group" value={selectedEmp.blood_group} />
                <InfoItem icon={ShieldAlert} label="Emergency Contact" value={selectedEmp.emergency_contact} />
                <InfoItem icon={Banknote} label="Base Salary" value={formatCurrency(selectedEmp.base_salary, "BDT")} />
                <InfoItem icon={Search} label="Employee ID" value={selectedEmp.employee_code || selectedEmp.id.slice(0, 8)} />
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setSelectedEmp(null)}>Close</Button>
                <Button onClick={() => {
                  const emp = selectedEmp;
                  setSelectedEmp(null);
                  setEditingEmp(emp);
                }}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Details
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog open={!!managingRole} onOpenChange={(o) => !o && setManagingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Access: {managingRole?.full_name}</DialogTitle>
            <DialogDescription>Grant or remove administrative roles for this team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {["super_admin", "project_manager", "staff"].map((role) => {
              const has = userRoles.includes(role);
              return (
                <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="capitalize font-medium">{role.replace("_", " ")}</span>
                  <Button 
                    size="sm" 
                    variant={has ? "destructive" : "default"}
                    onClick={async () => {
                      if (!userId) return;
                      await setRole(userId, role, !has);
                      setUserRoles(prev => has ? prev.filter(r => r !== role) : [...prev, role]);
                    }}
                  >
                    {has ? "Revoke" : "Grant"}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      {editingEmp && (
        <EmployeeSheet 
          key={editingEmp.id}
          mode="edit"
          initialData={editingEmp}
          open={!!editingEmp}
          onOpenChange={(o) => !o && setEditingEmp(null)}
          onSubmit={(data) => updateEmployee(editingEmp.id, data)}
        />
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EmployeeSheet({ 
  mode, 
  initialData, 
  onSubmit,
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: { 
  mode: "create" | "edit";
  initialData?: Employee;
  onSubmit: (e: Omit<Employee, "id">) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = externalOnOpenChange ?? setInternalOpen;

  const [f, setF] = useState({
    employee_code: initialData?.employee_code ?? "",
    full_name: initialData?.full_name ?? "",
    email: initialData?.email ?? "",
    designation: initialData?.designation ?? "",
    department: initialData?.department ?? "Engineering",
    phone: initialData?.phone ?? "",
    blood_group: initialData?.blood_group ?? "",
    emergency_contact: initialData?.emergency_contact ?? "",
    joined_at: initialData?.joined_at ?? new Date().toISOString().slice(0, 10),
    base_salary: initialData?.base_salary?.toString() ?? "0",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ ...f, base_salary: Number(f.base_salary) || 0 });
    setOpen(false);
    if (mode === "create") {
      setF({ 
        employee_code: "",
        full_name: "", email: "", designation: "", department: "Engineering", 
        phone: "", blood_group: "", emergency_contact: "", 
        joined_at: new Date().toISOString().slice(0, 10), base_salary: "0" 
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {mode === "create" && (
        <SheetTrigger asChild>
          <Button><Plus className="h-4 w-4 mr-1.5" /> Add employee</Button>
        </SheetTrigger>
      )}
      <SheetContent className="overflow-y-auto sm:max-w-[450px]">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add employee" : "Edit employee"}</SheetTitle>
          <SheetDescription>
            {mode === "create" 
              ? "Add a new team member to the directory." 
              : `Update information for ${initialData?.full_name}.`}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-8">
          <Fld label="Employee ID (Custom)">
            <Input placeholder="e.g. CNDEV-101" value={f.employee_code} onChange={(e) => setF({ ...f, employee_code: e.target.value })} />
          </Fld>
          <Fld label="Full name">
            <Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Fld>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Email Address">
              <Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Fld>
            <Fld label="Phone Number">
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Designation">
              <Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
            </Fld>
            <Fld label="Department">
              <Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Blood Group">
              <Input value={f.blood_group} onChange={(e) => setF({ ...f, blood_group: e.target.value })} />
            </Fld>
            <Fld label="Joining Date">
              <Input type="date" value={f.joined_at} onChange={(e) => setF({ ...f, joined_at: e.target.value })} />
            </Fld>
          </div>
          <Fld label="Emergency Contact Info">
            <Input value={f.emergency_contact} onChange={(e) => setF({ ...f, emergency_contact: e.target.value })} />
          </Fld>
          <Fld label="Base Monthly Salary (BDT)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">৳</span>
              <Input type="number" className="pl-7" value={f.base_salary} onChange={(e) => setF({ ...f, base_salary: e.target.value })} />
            </div>
          </Fld>
          <SheetFooter className="pt-4">
            <Button type="submit" className="w-full">
              {mode === "create" ? "Add to Directory" : "Save Changes"}
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
