"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Plus, Mail, Phone, Building2, MapPin, Loader2 } from "lucide-react";
import { formatCurrency, avatarColor } from "../../../lib/format";
import { toast } from "sonner";

interface Client {
  id: string; company_name: string; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null;
  vat_bin: string | null; currency: "BDT" | "USD"; ltv: number; notes: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("ltv", { ascending: false });
    if (error) toast.error(error.message);
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }

  const totalLtvBDT = clients.filter((c) => c.currency === "BDT").reduce((s, c) => s + Number(c.ltv), 0);
  const totalLtvUSD = clients.filter((c) => c.currency === "USD").reduce((s, c) => s + Number(c.ltv), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">{clients.length} active accounts · {formatCurrency(totalLtvBDT, "BDT")} + {formatCurrency(totalLtvUSD, "USD")} lifetime value</p>
        </div>
        <NewClientSheet onCreated={load} />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className={avatarColor(c.company_name)}>
                      <Building2 className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{c.company_name}</CardTitle>
                    <CardDescription className="text-xs truncate">{c.contact_person ?? "—"}</CardDescription>
                  </div>
                  <Badge variant="outline">{c.currency}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {c.email && <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{c.phone}</div>}
                {c.address && <div className="flex items-center gap-2 truncate"><MapPin className="h-3 w-3 shrink-0" />{c.address}</div>}
                <div className="flex items-center justify-between pt-3 mt-2 border-t">
                  <span className="text-[10px] uppercase tracking-wider">Lifetime value</span>
                  <span className="text-foreground font-bold text-sm">{formatCurrency(Number(c.ltv), c.currency)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewClientSheet({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    company_name: "", contact_person: "", email: "", phone: "",
    address: "", vat_bin: "", currency: "BDT" as "BDT" | "USD",
    ltv: "0", notes: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("clients").insert({
      company_name: f.company_name,
      contact_person: f.contact_person || null,
      email: f.email || null, phone: f.phone || null,
      address: f.address || null, vat_bin: f.vat_bin || null,
      currency: f.currency, ltv: Number(f.ltv) || 0,
      notes: f.notes || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Client created");
    setOpen(false);
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New client</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>New client</SheetTitle><SheetDescription>Add a new account to your CRM.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Company name"><Input required value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Fld>
          <Fld label="Contact person"><Input value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Fld>
            <Fld label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Fld>
          </div>
          <Fld label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="VAT / BIN"><Input value={f.vat_bin} onChange={(e) => setF({ ...f, vat_bin: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Lifetime value"><Input type="number" value={f.ltv} onChange={(e) => setF({ ...f, ltv: e.target.value })} /></Fld>
          <Fld label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></Fld>
          <SheetFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create client"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
