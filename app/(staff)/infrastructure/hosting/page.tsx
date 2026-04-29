"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Server, Database, CreditCard, Search, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import Link from "next/link";

interface Asset {
  id: string; name: string; asset_type: string; provider: string | null;
  expires_at: string | null; cost: number; currency: "BDT" | "USD";
  client_id: string | null;
}
interface Client { id: string; company_name: string }

const ICON: Record<string, typeof Server> = { hosting: Server, vps: Database, subscription: CreditCard };

export default function HostingPage() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: a, error }, { data: c }] = await Promise.all([
      supabase.from("infrastructure_assets").select("*").in("asset_type", ["hosting", "vps", "subscription"]).order("expires_at"),
      supabase.from("clients").select("id, company_name"),
    ]);
    if (error) toast.error(error.message);
    setRows((a ?? []) as Asset[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  const daysUntil = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : Infinity;
  const filtered = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const totalAnnualUSD = rows.reduce((s, r) => s + (r.currency === "USD" ? Number(r.cost) : Number(r.cost) / 110), 0);
  const expiringSoon = rows.filter((r) => daysUntil(r.expires_at) <= 30 && daysUntil(r.expires_at) >= 0).length;
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "Internal";

  function badge(d: string | null) {
    const days = daysUntil(d);
    if (days === Infinity) return <Badge variant="outline">No expiry</Badge>;
    if (days < 0) return <Badge variant="destructive">{Math.abs(days)}d overdue</Badge>;
    if (days <= 7) return <Badge variant="destructive">{days}d</Badge>;
    if (days <= 30) return <Badge className="bg-warning text-warning-foreground">{days}d</Badge>;
    return <Badge variant="secondary">{days}d</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hosting & Infrastructure</h1>
          <p className="text-muted-foreground mt-1">Web hosting, VPS, and SaaS subscriptions powering client work.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/infrastructure">Manage all assets <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active services</p>
          <p className="text-2xl font-bold mt-1">{rows.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Annual spend (≈ USD)</p>
          <p className="text-2xl font-bold mt-1">${totalAnnualUSD.toFixed(0)}</p>
        </CardContent></Card>
        <Card className={expiringSoon > 0 ? "border-warning/40" : ""}>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Renewals &lt; 30d</p>
            <p className="text-2xl font-bold mt-1">{expiringSoon}</p>
          </CardContent>
        </Card>
      </div>

      {expiringSoon > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="text-sm"><span className="font-medium">{expiringSoon}</span> service(s) renew within 30 days. Confirm budgets.</div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hosting…" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">All hosting & subscriptions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Service</TableHead><TableHead>Type</TableHead><TableHead>Client</TableHead>
                <TableHead>Provider</TableHead><TableHead>Cost</TableHead>
                <TableHead>Renews</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Server className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No hosting yet — add one from the Infrastructure page.
                  </TableCell></TableRow>
                ) : filtered.map((r) => {
                  const Icon = ICON[r.asset_type] ?? Server;
                  return (
                    <TableRow key={r.id}>
                      <TableCell><div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{r.name}</span>
                      </div></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.asset_type}</Badge></TableCell>
                      <TableCell className="text-sm">{clientName(r.client_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.provider ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCurrency(Number(r.cost), r.currency)}</TableCell>
                      <TableCell className="text-sm">{formatDate(r.expires_at)}</TableCell>
                      <TableCell>{badge(r.expires_at)}</TableCell>
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
