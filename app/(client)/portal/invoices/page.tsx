"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../../components/ui/dialog";
import { Loader2, Eye, Download, Receipt } from "lucide-react";
import { supabase } from "../../../../integrations/supabase/client";
import { useAuth } from "../../../../lib/auth-context";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";

interface Invoice {
  id: string; number: string; title: string;
  subtotal: number; tax_rate: number; tax_amount: number; total: number; paid_amount: number;
  currency: string; status: string; notes: string | null;
  issued_at: string; due_at: string | null; paid_at: string | null;
}
interface InvoiceItem { id: string; description: string; quantity: number; unit_price: number; amount: number | null; }

export default function ClientInvoices() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [active, setActive] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (!profile?.client_id) { setLoading(false); return; }
    void supabase.from("invoices").select("*").eq("client_id", profile.client_id).order("issued_at", { ascending: false })
      .then(({ data }) => { setInvoices((data ?? []) as unknown as Invoice[]); setLoading(false); });
  }, [profile?.client_id]);

  const openInvoice = async (inv: Invoice) => {
    setActive(inv);
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("position");
    setItems((data ?? []) as unknown as InvoiceItem[]);
  };

  const totals = invoices.reduce<Record<string, { paid: number; outstanding: number }>>((acc, i) => {
    if (!acc[i.currency]) acc[i.currency] = { paid: 0, outstanding: 0 };
    acc[i.currency].paid += Number(i.paid_amount);
    acc[i.currency].outstanding += Math.max(Number(i.total) - Number(i.paid_amount), 0);
    return acc;
  }, {});

  const variant = (s: string) =>
    s === "paid" ? "default" : s === "overdue" ? "destructive" : s === "partial" ? "secondary" : "outline";

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-muted-foreground mt-1">Review billing history and outstanding amounts.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(totals).map(([c, t]) => (
          <Card key={c}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Paid ({c})</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(t.paid, c)}</p>
          </CardContent></Card>
        ))}
        {Object.entries(totals).map(([c, t]) => (
          <Card key={c + "out"}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding ({c})</p>
            <p className={`text-2xl font-bold mt-1 ${t.outstanding > 0 ? "text-warning-foreground" : ""}`}>{formatCurrency(t.outstanding, c)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All invoices</CardTitle></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead><TableHead>Description</TableHead>
                  <TableHead>Issued</TableHead><TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => openInvoice(i)}>
                    <TableCell className="font-mono text-xs">{i.number}</TableCell>
                    <TableCell className="text-sm">{i.title}</TableCell>
                    <TableCell className="text-sm">{formatDate(i.issued_at)}</TableCell>
                    <TableCell className="text-sm">{i.due_at ? formatDate(i.due_at) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(i.total, i.currency)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(i.paid_amount, i.currency)}</TableCell>
                    <TableCell><Badge variant={variant(i.status) as any} className="capitalize">{i.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{active.number}</DialogTitle>
                <DialogDescription>{active.title}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-4 py-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Issued</p><p className="font-medium">{formatDate(active.issued_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Due</p><p className="font-medium">{active.due_at ? formatDate(active.due_at) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={variant(active.status) as any} className="capitalize">{active.status}</Badge></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-sm">{it.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{it.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(it.unit_price, active.currency)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(it.amount ?? 0, active.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(active.subtotal, active.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">{formatCurrency(active.tax_amount, active.currency)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="font-mono">{formatCurrency(active.total, active.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-mono text-success">{formatCurrency(active.paid_amount, active.currency)}</span></div>
                <div className="flex justify-between font-semibold"><span>Balance</span><span className="font-mono">{formatCurrency(Math.max(active.total - active.paid_amount, 0), active.currency)}</span></div>
              </div>
              <div className="flex gap-2 justify-end flex-wrap">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { data: client } = await supabase
                        .from("clients")
                        .select("company_name, contact_person, email, phone, address, vat_bin")
                        .eq("id", profile?.client_id ?? "")
                        .maybeSingle();
                      const { downloadInvoicePdf } = await import("../../../../lib/pdf/invoice");
                      await downloadInvoicePdf(active as any, items as any, client ?? null);
                      toast.success("PDF downloaded");
                    } catch (e) {
                      toast.error("Could not generate PDF");
                      console.error(e);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
                {active.status === "paid" && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { data: client } = await supabase
                          .from("clients")
                          .select("company_name, contact_person, email, phone, address, vat_bin")
                          .eq("id", profile?.client_id ?? "")
                          .maybeSingle();
                        const { downloadReceiptPdf } = await import("../../../../lib/pdf/receipt");
                        await downloadReceiptPdf({
                          invoice: active as any,
                          client: client ?? null,
                          amountPaid: Number(active.paid_amount) || Number(active.total),
                          paidAt: active.paid_at ?? new Date().toISOString().slice(0, 10),
                          paymentMethod: "—",
                        });
                        toast.success("Receipt downloaded");
                      } catch (e) {
                        toast.error("Could not generate receipt");
                        console.error(e);
                      }
                    }}
                  >
                    <Receipt className="h-4 w-4 mr-2" /> Receipt
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
