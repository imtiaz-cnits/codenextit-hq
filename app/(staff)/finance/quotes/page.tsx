"use client";

import { useState } from "react";
import { useMock, type Quotation } from "../../../../lib/mock-store";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Plus, Download } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import { TableSkeleton } from "../../../../components/loading-skeletons";

export default function QuotesPage() {
  const { quotations, addQuotation, loading } = useMock();
  
  if (loading) return <TableSkeleton rows={8} cols={7} />;
  const totalSent = quotations.filter((q) => q.status === "sent" || q.status === "accepted").reduce((s, q) => q.currency === "BDT" ? s + q.amount : s, 0);
  const totalAccepted = quotations.filter((q) => q.status === "accepted").length;

  const getVariant = (s: string) => s === "accepted" ? "default" : s === "sent" ? "secondary" : s === "rejected" ? "destructive" : "outline";

  const exportQuotePdf = async (q: Quotation) => {
    try {
      const { downloadQuotePdf } = await import("../../../../lib/pdf/quote");
      await downloadQuotePdf(
        {
          number: q.number,
          title: `Proposal for ${q.client_name}`,
          status: q.status,
          currency: q.currency,
          subtotal: q.amount,
          tax_rate: 0,
          tax_amount: 0,
          total: q.amount,
          issued_at: q.date,
          valid_until: q.valid_until,
          notes: null,
        },
        [{ description: `Proposal for ${q.client_name}`, quantity: 1, unit_price: q.amount, amount: q.amount }],
        { company_name: q.client_name, contact_person: null, email: null, phone: null, address: null, vat_bin: null },
      );
      toast.success("Quotation PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground mt-1">Track every proposal you've sent and its conversion status.</p>
        </div>
        <NewQuoteSheet onAdd={addQuotation} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Open BDT pipeline</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalSent, "BDT")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Accepted</p>
          <p className="text-2xl font-bold mt-1">{totalAccepted}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total quotes</p>
          <p className="text-2xl font-bold mt-1">{quotations.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All quotations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Client</TableHead><TableHead>Amount</TableHead>
              <TableHead>Date</TableHead><TableHead>Valid until</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.number}</TableCell>
                  <TableCell>{q.client_name}</TableCell>
                  <TableCell>{formatCurrency(q.amount, q.currency)}</TableCell>
                  <TableCell className="text-sm">{formatDate(q.date)}</TableCell>
                  <TableCell className="text-sm">{formatDate(q.valid_until)}</TableCell>
                  <TableCell><Badge variant={getVariant(q.status) as any} className="capitalize">{q.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => exportQuotePdf(q)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewQuoteSheet({ onAdd }: { onAdd: (q: Omit<Quotation, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    number: `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    client_name: "", amount: "0", currency: "BDT" as "BDT" | "USD",
    status: "draft" as Quotation["status"],
    date: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({ ...f, amount: Number(f.amount) || 0 });
    toast.success("Quote created");
    setOpen(false);
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New quote</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>New quotation</SheetTitle><SheetDescription>Add a new proposal.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Quote number"><Input required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Fld>
          <Fld label="Client"><Input required value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Amount"><Input type="number" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Fld>
            <Fld label="Valid until"><Input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Fld>
          </div>
          <Fld label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Quotation["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["draft", "sent", "accepted", "rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <SheetFooter><Button type="submit">Create quote</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
