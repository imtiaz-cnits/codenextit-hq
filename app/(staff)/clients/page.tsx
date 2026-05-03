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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { Edit, Trash2, MoreHorizontal, Mail, Phone, Building2, MapPin, Loader2, Plus, Info, Globe, Tag, FileText } from "lucide-react";
import { formatCurrency, avatarColor } from "../../../lib/format";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Skeleton } from "../../../components/ui/skeleton";

interface Client {
  id: string; company_name: string; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null;
  vat_bin: string | null; currency: "BDT" | "USD"; ltv: number; notes: string | null;
  website?: string | null; industry?: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("ltv", { ascending: false });
    if (error) toast.error(error.message);
    setClients((data as any ?? []) as Client[]);
    setLoading(false);
  }

  async function deleteClient(id: string) {
    if (!confirm("Are you sure you want to delete this client?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Client deleted");
    void load();
    setIsDetailsOpen(false);
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
        <Button onClick={() => { setEditingClient(null); setIsSheetOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> New client</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6 space-y-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <div className="space-y-3 pt-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <div className="flex items-center justify-between pt-3 mt-2 border-t">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card 
              key={c.id} 
              className="hover:shadow-elegant transition-all cursor-pointer group relative overflow-hidden"
              onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback className={avatarColor(c.company_name)}>
                      <Building2 className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{c.company_name}</CardTitle>
                    <CardDescription className="text-xs truncate">{c.contact_person ?? "—"}</CardDescription>
                  </div>
                  <Badge variant="outline">{c.currency}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground pb-4">
                {c.email && <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{c.phone}</div>}
                <div className="flex items-center justify-between pt-3 mt-2 border-t">
                  <span className="text-[10px] uppercase tracking-wider">Lifetime value</span>
                  <span className="text-foreground font-bold text-sm">{formatCurrency(Number(c.ltv), c.currency)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedClient && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className={avatarColor(selectedClient.company_name)}>
                      <Building2 className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">{selectedClient.company_name}</DialogTitle>
                    <DialogDescription>{selectedClient.industry || "General Industry"}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-1 gap-6 py-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Contact Person</p>
                      <p>{selectedClient.contact_person || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Email Address</p>
                      <p>{selectedClient.email || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Phone Number</p>
                      <p>{selectedClient.phone || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">VAT / BIN</p>
                      <p>{selectedClient.vat_bin || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</h4>
                  <p className="text-sm">{selectedClient.address || "No address provided."}</p>
                </div>

                {selectedClient.notes && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Internal Notes</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground italic">
                      "{selectedClient.notes}"
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime Revenue</p>
                    <p className="text-xl font-black text-primary">{formatCurrency(selectedClient.ltv, selectedClient.currency)}</p>
                  </div>
                  <Badge className="h-fit">{selectedClient.currency}</Badge>
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 justify-end sm:justify-end border-t pt-4">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setIsDetailsOpen(false); setEditingClient(selectedClient); setIsSheetOpen(true); }}>
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => deleteClient(selectedClient.id)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClientSheet 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        onCreated={load} 
        editingClient={editingClient} 
      />
    </div>
  );
}

function ClientSheet({ open, onOpenChange, onCreated, editingClient }: { 
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; editingClient: Client | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    company_name: "", contact_person: "", email: "", phone: "",
    address: "", vat_bin: "", currency: "BDT" as "BDT" | "USD",
    ltv: "0", notes: "", website: "", industry: "",
  });

  useEffect(() => {
    if (editingClient) {
      setF({
        company_name: editingClient.company_name,
        contact_person: editingClient.contact_person || "",
        email: editingClient.email || "",
        phone: editingClient.phone || "",
        address: editingClient.address || "",
        vat_bin: editingClient.vat_bin || "",
        currency: editingClient.currency,
        ltv: editingClient.ltv.toString(),
        notes: editingClient.notes || "",
        website: editingClient.website || "",
        industry: editingClient.industry || "",
      });
    } else {
      setF({
        company_name: "", contact_person: "", email: "", phone: "",
        address: "", vat_bin: "", currency: "BDT", ltv: "0", notes: "",
        website: "", industry: "",
      });
    }
  }, [editingClient, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    const clientData = {
      company_name: f.company_name,
      contact_person: f.contact_person || null,
      email: f.email || null, phone: f.phone || null,
      address: f.address || null, vat_bin: f.vat_bin || null,
      currency: f.currency, ltv: Number(f.ltv) || 0,
      notes: f.notes || null, website: f.website || null,
      industry: f.industry || null,
    };

    const { error } = editingClient 
      ? await (supabase.from("clients") as any).update(clientData).eq("id", editingClient.id)
      : await (supabase.from("clients") as any).insert(clientData);

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(editingClient ? "Client updated" : "Client created");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingClient ? "Edit Client" : "New Client"}</SheetTitle>
          <SheetDescription>{editingClient ? "Update client profile details." : "Add a new account to your CRM."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Company name"><Input required value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Contact person"><Input value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} /></Fld>
            <Fld label="Industry"><Input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Fld>
            <Fld label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Fld>
          </div>
          <Fld label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://..." /></Fld>
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
          <SheetFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingClient ? "Update Client" : "Create Client"}
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
