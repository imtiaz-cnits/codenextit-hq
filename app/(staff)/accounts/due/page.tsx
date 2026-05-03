"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Loader2, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import Link from "next/link";
import { TableSkeleton } from "../../../../components/loading-skeletons";

interface InvoiceRow {
  id: string; number: string; title: string;
  client_id: string | null; total: number; paid_amount: number;
  currency: "BDT" | "USD"; status: string; due_at: string | null; issued_at: string;
}
interface Client { id: string; company_name: string; }

export default function DuePage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: inv, error }, { data: c }] = await Promise.all([
      supabase.from("invoices").select("*").neq("status", "paid").neq("status", "cancelled").order("due_at"),
      supabase.from("clients").select("id, company_name"),
    ]);
    if (error) toast.error(error.message);
    setRows((inv ?? []) as InvoiceRow[]);
    setClients((c ?? []) as Client[]);
    setLoading(false);
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";
  const outstanding = (r: InvoiceRow) => Number(r.total) - Number(r.paid_amount);
  const isOverdue = (r: InvoiceRow) => r.due_at ? new Date(r.due_at).getTime() < Date.now() : false;

  const totalDueBDT = rows.filter(r => r.currency === "BDT").reduce((s, r) => s + outstanding(r), 0);
  const totalDueUSD = rows.filter(r => r.currency === "USD").reduce((s, r) => s + outstanding(r), 0);
  const overdueCount = rows.filter(isOverdue).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Due</h1>
        <p className="text-muted-foreground mt-1">Unpaid client invoices and outstanding balances.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Open invoices" value={rows.length.toString()} />
        <Stat label="Overdue" value={overdueCount.toString()} highlight={overdueCount > 0} />
        <Stat label="Outstanding (BDT)" value={formatCurrency(totalDueBDT, "BDT")} />
        <Stat label="Outstanding (USD)" value={formatCurrency(totalDueUSD, "USD")} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Outstanding invoices</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />Nothing due — well done!</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice</TableHead><TableHead>Client</TableHead>
                <TableHead>Issued</TableHead><TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={isOverdue(r) ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <Link href="/finance/invoices" className="font-medium text-sm text-primary hover:underline">{r.number}</Link>
                      <div className="text-xs text-muted-foreground">{r.title}</div>
                    </TableCell>
                    <TableCell className="text-sm">{clientName(r.client_id)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.issued_at)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.due_at)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(Number(r.total), r.currency)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(Number(r.paid_amount), r.currency)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(outstanding(r), r.currency)}</TableCell>
                    <TableCell>
                      {isOverdue(r)
                        ? <Badge variant="destructive">Overdue</Badge>
                        : <Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive/40" : ""}><CardContent className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}
