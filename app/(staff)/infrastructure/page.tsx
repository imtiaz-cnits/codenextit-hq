"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Globe, ShieldCheck, Server, Database, CreditCard, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, formatRelativeDays } from "../../../lib/format";
import { toast } from "sonner";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";

type AssetType = "domain" | "ssl" | "hosting" | "vps" | "subscription";
interface Asset {
  id: string; name: string; asset_type: AssetType; provider: string | null;
  expires_at: string | null; cost: number; currency: "BDT" | "USD";
  client_id: string | null; notes: string | null;
}
interface Client { id: string; company_name: string; }

const TYPE_ICON: Record<AssetType, typeof Globe> = {
  domain: Globe, ssl: ShieldCheck, hosting: Server, vps: Database, subscription: CreditCard,
};

export default function InfraPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: a, error }, { data: c }] = await Promise.all([
      supabase.from("infrastructure_assets").select("*").order("expires_at"),
      supabase.from("clients").select("id, company_name"),
    ]);
    if (error) toast.error(error.message);
    setAssets((a ?? []) as Asset[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  const daysUntil = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : Infinity;
  const expiringSoon = assets.filter((a) => daysUntil(a.expires_at) <= 30 && daysUntil(a.expires_at) >= 0);
  const expired = assets.filter((a) => daysUntil(a.expires_at) < 0);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "Internal";

  function expiryBadge(d: string | null) {
    const days = daysUntil(d);
    if (days === Infinity) return <Badge variant="outline">No expiry</Badge>;
    if (days < 0) return <Badge variant="destructive">{Math.abs(days)}d overdue</Badge>;
    if (days <= 7) return <Badge variant="destructive">{days}d left</Badge>;
    if (days <= 30) return <Badge className="bg-warning text-warning-foreground">{days}d left</Badge>;
    return <Badge variant="secondary">{formatRelativeDays(d)}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Infrastructure</h1>
          <p className="text-muted-foreground mt-1">Domains, SSL, hosting, VPS and subscriptions across all clients.</p>
        </div>
        <NewAssetSheet clients={clients} onCreated={load} />
      </div>

      {(expiringSoon.length > 0 || expired.length > 0) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-medium">{expired.length} expired</span> ·{" "}
              <span className="font-medium">{expiringSoon.length} expiring within 30 days</span>. Review renewals to avoid downtime.
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">All assets</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>Client</TableHead>
                <TableHead>Provider</TableHead><TableHead>Cost</TableHead>
                <TableHead>Expires</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {assets.map((a) => {
                  const Icon = TYPE_ICON[a.asset_type];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{a.name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.asset_type}</Badge></TableCell>
                      <TableCell className="text-sm">{clientName(a.client_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.provider ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCurrency(Number(a.cost), a.currency)}</TableCell>
                      <TableCell className="text-sm">{formatDate(a.expires_at)}</TableCell>
                      <TableCell>{expiryBadge(a.expires_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NewAssetSheet({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    name: "", asset_type: "domain" as AssetType, provider: "", expires_at: "",
    cost: "0", currency: "USD" as "BDT" | "USD", client_id: "", notes: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("infrastructure_assets").insert({
      name: f.name, asset_type: f.asset_type, provider: f.provider || null,
      expires_at: f.expires_at || null, cost: Number(f.cost) || 0, currency: f.currency,
      client_id: f.client_id || null, notes: f.notes || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Asset added");
    setOpen(false);
    onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Add asset</Button></SheetTrigger>
      <SheetContent className="flex flex-col h-full p-0 w-full sm:max-w-lg">
        <div className="py-3 px-6 border-b border-border/40 shrink-0">
          <SheetHeader>
            <SheetTitle>Add infrastructure asset</SheetTitle>
            <SheetDescription>Track a domain, SSL, hosting or subscription.</SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Fld label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. example.com" /></Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Type">
                <Select value={f.asset_type} onValueChange={(v) => setF({ ...f, asset_type: v as AssetType })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>{(["domain", "ssl", "hosting", "vps", "subscription"] as AssetType[]).map((t) => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld label="Provider"><Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} /></Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Client (optional)">
                <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Internal" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld label="Expires">
                <FlatDatePicker
                  date={f.expires_at || ""}
                  onChange={(d) => setF({ ...f, expires_at: d })}
                  placeholder="Select expiry date"
                />
              </Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Cost"><Input type="number" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Fld>
              <Fld label="Currency">
                <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD" className="cursor-pointer">USD</SelectItem><SelectItem value="BDT" className="cursor-pointer">BDT</SelectItem></SelectContent>
                </Select>
              </Fld>
            </div>
            <Fld label="Notes"><Textarea value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></Fld>
          </div>

          <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
            <SheetFooter className="mt-0">
              <Button type="submit" disabled={submitting} className="w-full cursor-pointer">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : "Add asset"}</Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
