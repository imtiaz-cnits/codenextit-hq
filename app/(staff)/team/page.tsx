"use client";

import { useState } from "react";
import { useMock, type Employee } from "../../../lib/mock-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Plus, Phone, Mail, Heart, Search } from "lucide-react";
import { initials, avatarColor, formatCurrency, formatDate } from "../../../lib/format";

const DEPARTMENTS = ["All", "Engineering", "Design", "SEO", "Management"];

export default function TeamPage() {
  const { employees, addEmployee } = useMock();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");

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
        <NewEmployeeSheet onCreate={addEmployee} />
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
          <Card key={e.id} className="hover:shadow-elegant transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={avatarColor(e.full_name)}>{initials(e.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base truncate">{e.full_name}</CardTitle>
                  <CardDescription className="text-xs truncate">{e.designation}</CardDescription>
                  <Badge variant="secondary" className="mt-1.5 text-[10px]">{e.department}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" />{e.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{e.phone}</div>
              <div className="flex items-center gap-2"><Heart className="h-3 w-3 shrink-0" /> {e.blood_group} · joined {formatDate(e.joined_at)}</div>
              <div className="text-foreground font-medium pt-2 border-t mt-2">{formatCurrency(e.base_salary, "BDT")}/mo</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewEmployeeSheet({ onCreate }: { onCreate: (e: Omit<Employee, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    full_name: "", email: "", designation: "", department: "Engineering",
    phone: "", blood_group: "", emergency_contact: "",
    joined_at: new Date().toISOString().slice(0, 10), base_salary: "0",
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({ ...f, base_salary: Number(f.base_salary) || 0 });
    setOpen(false);
    setF({ full_name: "", email: "", designation: "", department: "Engineering", phone: "", blood_group: "", emergency_contact: "", joined_at: new Date().toISOString().slice(0, 10), base_salary: "0" });
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add employee</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Add employee</SheetTitle><SheetDescription>Add a new team member to the directory.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Full name"><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Fld>
            <Fld label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Designation"><Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></Fld>
            <Fld label="Department">
              <Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.filter((d) => d !== "All").map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Blood group"><Input value={f.blood_group} onChange={(e) => setF({ ...f, blood_group: e.target.value })} /></Fld>
            <Fld label="Joined"><Input type="date" value={f.joined_at} onChange={(e) => setF({ ...f, joined_at: e.target.value })} /></Fld>
          </div>
          <Fld label="Emergency contact"><Input value={f.emergency_contact} onChange={(e) => setF({ ...f, emergency_contact: e.target.value })} /></Fld>
          <Fld label="Base salary (BDT)"><Input type="number" value={f.base_salary} onChange={(e) => setF({ ...f, base_salary: e.target.value })} /></Fld>
          <SheetFooter><Button type="submit">Add employee</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
