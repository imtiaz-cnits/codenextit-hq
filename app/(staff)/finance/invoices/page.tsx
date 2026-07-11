"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
import { Checkbox } from "../../../../components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../../../components/ui/dropdown-menu";
import { Plus, Loader2, Eye, Trash2, CheckCircle2, Download, FileArchive, FileText, Receipt } from "lucide-react";
import { supabase } from "../../../../integrations/supabase/client";
import { useAuth } from "../../../../lib/auth-context";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import { TableSkeleton } from "../../../../components/loading-skeletons";

interface Invoice {
  id: string; number: string; client_id: string | null; title: string;
  subtotal: number; tax_rate: number; tax_amount: number; total: number; paid_amount: number;
  currency: string; status: string;
  issued_at: string; due_at: string | null; paid_at: string | null;
  notes: string | null;
}
interface InvoiceItem { id: string; description: string; quantity: number; unit_price: number; amount: number | null; }
interface Client { id: string; company_name: string }

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [active, setActive] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [receiptFor, setReceiptFor] = useState<Invoice | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: cs }] = await Promise.all([
      supabase.from("invoices").select("*").order("issued_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").eq("is_vault_folder", false).order("company_name"),
    ]);
    setInvoices(inv as Invoice[] ?? []);
    setClients(cs as Client[] ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const openInvoice = async (inv: Invoice) => {
    setActive(inv);
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("position");
    setItems(data as InvoiceItem[] ?? []);
  };

  const markPaid = async (inv: Invoice) => {
    const { error } = await supabase.from("invoices").update({
      status: "paid" as any, paid_amount: inv.total, paid_at: new Date().toISOString().slice(0, 10),
    }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid", {
      action: { label: "Receipt", onClick: () => setReceiptFor({ ...inv, status: "paid", paid_amount: inv.total, paid_at: new Date().toISOString().slice(0, 10) }) },
    });
    void load();
    if (active?.id === inv.id) setActive({ ...inv, status: "paid", paid_amount: inv.total, paid_at: new Date().toISOString().slice(0, 10) });
  };

  const exportSelected = async (mode: "merged" | "zip") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const list = invoices.filter((i) => selected.has(i.id));
      const ids = list.map((i) => i.id);
      const [{ data: allItems }, { data: allClients }] = await Promise.all([
        supabase.from("invoice_items").select("*").in("invoice_id", ids).order("position"),
        supabase.from("clients").select("id, company_name, contact_person, email, phone, address, vat_bin").eq("is_vault_folder", false),
      ]);
      const itemsByInvoice = new Map<string, InvoiceItem[]>();
      (allItems ?? []).forEach((it) => {
        const arr = itemsByInvoice.get(it.invoice_id) ?? [];
        arr.push(it as InvoiceItem);
        itemsByInvoice.set(it.invoice_id, arr);
      });
      const clientById = new Map<string, any>();
      (allClients ?? []).forEach((c) => clientById.set(c.id, c));
      const jobs = list.map((inv) => ({
        invoice: inv,
        items: itemsByInvoice.get(inv.id) ?? [],
        client: inv.client_id ? clientById.get(inv.client_id) ?? null : null,
      }));
      const { buildMergedInvoicesPdf, buildInvoicesZip, downloadBlob } = await import("../../../../lib/pdf/bulk");
      const stamp = new Date().toISOString().slice(0, 10);
      if (mode === "merged") {
        const blob = await buildMergedInvoicesPdf(jobs);
        downloadBlob(blob, `invoices-${stamp}.pdf`);
      } else {
        const blob = await buildInvoicesZip(jobs);
        downloadBlob(blob, `invoices-${stamp}.zip`);
      }
      toast.success(`Exported ${jobs.length} invoice${jobs.length === 1 ? "" : "s"}`);
    } catch (e) {
      console.error(e);
      toast.error("Bulk export failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invoice deleted");
    if (active?.id === id) setActive(null);
    void load();
  };

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const totals = invoices.reduce<Record<string, { paid: number; outstanding: number; overdue: number }>>((acc, i) => {
    if (!acc[i.currency]) acc[i.currency] = { paid: 0, outstanding: 0, overdue: 0 };
    acc[i.currency].paid += Number(i.paid_amount);
    const bal = Math.max(Number(i.total) - Number(i.paid_amount), 0);
    acc[i.currency].outstanding += bal;
    if (i.status === "overdue") acc[i.currency].overdue += bal;
    return acc;
  }, {});

  const getVariant = (s: string) =>
    s === "paid" ? "default" : s === "overdue" ? "destructive" : s === "partial" ? "secondary" : "outline";

  const isLoading = loading;

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Multi-currency billing across all clients.</p>
        </div>
        <NewInvoiceSheet clients={clients} onCreated={load} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(totals).slice(0, 2).map(([c, t]) => (
          <Card key={c}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Collected ({c})</p>
            <p className="text-2xl font-bold mt-1 text-success">{formatCurrency(t.paid, c)}</p>
          </CardContent></Card>
        ))}
        {Object.entries(totals).slice(0, 2).map(([c, t]) => (
          <Card key={c + "out"}><CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding ({c})</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(t.outstanding, c)}</p>
            {t.overdue > 0 && <p className="text-xs text-destructive mt-1">{formatCurrency(t.overdue, c)} overdue</p>}
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">All invoices</CardTitle>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={bulkBusy}>
                    {bulkBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    Export {selected.size} selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportSelected("merged")}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> Single merged PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected("zip")}>
                    <FileArchive className="h-3.5 w-3.5 mr-2" /> ZIP of separate PDFs
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["draft", "sent", "partial", "paid", "overdue", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} cols={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((i) => selected.has(i.id))}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) filtered.forEach((i) => next.add(i.id));
                        else filtered.forEach((i) => next.delete(i.id));
                        setSelected(next);
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Number</TableHead><TableHead>Client</TableHead><TableHead>Title</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No invoices.</TableCell></TableRow>}
                {filtered.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => openInvoice(i)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(i.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(selected);
                          if (c) next.add(i.id); else next.delete(i.id);
                          setSelected(next);
                        }}
                        aria-label={`Select invoice ${i.number}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.number}</TableCell>
                    <TableCell className="text-sm">{clientName(i.client_id)}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{i.title}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(i.total, i.currency)}</TableCell>
                    <TableCell className="text-right font-mono text-success">{formatCurrency(i.paid_amount, i.currency)}</TableCell>
                    <TableCell className="text-sm">{i.due_at ? formatDate(i.due_at) : "—"}</TableCell>
                    <TableCell><Badge variant={getVariant(i.status) as any} className="capitalize">{i.status}</Badge></TableCell>
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
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="font-mono">{active.number}</DialogTitle>
                    <DialogDescription>{active.title} · {clientName(active.client_id)}</DialogDescription>
                  </div>
                  <Badge variant={getVariant(active.status) as any} className="capitalize">{active.status}</Badge>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Issued</p><p>{formatDate(active.issued_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Due</p><p>{active.due_at ? formatDate(active.due_at) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p>{active.paid_at ? formatDate(active.paid_at) : "—"}</p></div>
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
                <div className="flex justify-between"><span className="text-muted-foreground">Tax ({active.tax_rate}%)</span><span className="font-mono">{formatCurrency(active.tax_amount, active.currency)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="font-mono">{formatCurrency(active.total, active.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-mono text-success">{formatCurrency(active.paid_amount, active.currency)}</span></div>
                <div className="flex justify-between font-semibold"><span>Balance</span><span className="font-mono">{formatCurrency(Math.max(active.total - active.paid_amount, 0), active.currency)}</span></div>
              </div>
              <div className="flex gap-2 justify-end flex-wrap">
                <Button variant="outline" onClick={() => remove(active.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { data: client } = active.client_id
                        ? await supabase
                          .from("clients")
                          .select("company_name, contact_person, email, phone, address, vat_bin")
                          .eq("id", active.client_id)
                          .maybeSingle()
                        : { data: null };
                      const { downloadInvoicePdf } = await import("../../../../lib/pdf/invoice");
                      await downloadInvoicePdf(active, items, client ?? null);
                      toast.success("PDF downloaded");
                    } catch (e) {
                      toast.error("Could not generate PDF");
                      console.error(e);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
                {active.status === "paid" && (
                  <Button variant="outline" onClick={() => setReceiptFor(active)}>
                    <Receipt className="h-4 w-4 mr-1.5" /> Receipt
                  </Button>
                )}
                {active.status !== "paid" && <Button onClick={() => markPaid(active)}><CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark paid</Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        invoice={receiptFor}
        clientName={receiptFor ? clientName(receiptFor.client_id) : ""}
        onClose={() => setReceiptFor(null)}
      />
    </div>
  );
}

function ReceiptDialog({ invoice, clientName, onClose }: { invoice: Invoice | null; clientName: string; onClose: () => void }) {
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (invoice) {
      setMethod("Bank transfer");
      setReference("");
    }
  }, [invoice?.id]);

  if (!invoice) return null;

  const generate = async () => {
    setBusy(true);
    try {
      const { data: client } = invoice.client_id
        ? await supabase
          .from("clients")
          .select("company_name, contact_person, email, phone, address, vat_bin")
          .eq("id", invoice.client_id)
          .maybeSingle()
        : { data: null };
      const { downloadReceiptPdf } = await import("../../../../lib/pdf/receipt");
      await downloadReceiptPdf({
        invoice,
        client: client ?? (clientName ? { company_name: clientName, contact_person: null, email: null, phone: null, address: null, vat_bin: null } : null),
        amountPaid: Number(invoice.paid_amount) || Number(invoice.total),
        paidAt: invoice.paid_at ?? new Date().toISOString().slice(0, 10),
        paymentMethod: method,
        reference: reference || null,
      });
      toast.success("Receipt downloaded");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not generate receipt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate receipt</DialogTitle>
          <DialogDescription>For invoice {invoice.number} · {clientName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Bank transfer", "bKash", "Nagad", "Cash", "Cheque", "Card", "PayPal", "Wise", "Other"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reference / transaction ID (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TRX-…" />
          </div>
          <div className="rounded-md bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount paid</span>
              <span className="font-mono font-semibold">{formatCurrency(Number(invoice.paid_amount) || Number(invoice.total), invoice.currency)}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment date</span>
              <span>{formatDate(invoice.paid_at ?? new Date().toISOString().slice(0, 10))}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="h-4 w-4 mr-1.5" /> Download receipt</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DraftItem { description: string; quantity: string; unit_price: string }

function NewInvoiceSheet({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    number: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    client_id: "", title: "", currency: "BDT" as "BDT" | "USD",
    tax_rate: "0",
    issued_at: new Date().toISOString().slice(0, 10),
    due_at: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: "",
  });
  const [items, setItems] = useState<DraftItem[]>([{ description: "", quantity: "1", unit_price: "0" }]);

  const setItem = (i: number, k: keyof DraftItem, v: string) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) * Number(it.unit_price)), 0);
  const taxAmount = subtotal * (Number(f.tax_rate) / 100);
  const total = subtotal + taxAmount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!f.client_id) return toast.error("Pick a client");
    setBusy(true);
    const { data: invoice, error } = await supabase.from("invoices").insert({
      number: f.number, client_id: f.client_id, title: f.title,
      currency: f.currency, tax_rate: Number(f.tax_rate),
      tax_amount: taxAmount, subtotal, total,
      issued_at: f.issued_at, due_at: f.due_at, notes: f.notes,
      status: "draft" as any, created_by: user.id,
    }).select().single();
    if (error || !invoice) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
    const itemRows = items.filter((it) => it.description.trim()).map((it, idx) => ({
      invoice_id: invoice.id, description: it.description,
      quantity: Number(it.quantity), unit_price: Number(it.unit_price), position: idx + 1,
    }));
    if (itemRows.length) await supabase.from("invoice_items").insert(itemRows);
    setBusy(false);
    toast.success("Invoice created");
    setOpen(false);
    onCreated();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New invoice</Button></SheetTrigger>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>New invoice</SheetTitle><SheetDescription>Create a draft invoice. You can mark it sent or paid later.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Number"><Input required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT (৳)</SelectItem><SelectItem value="USD">USD ($)</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Client">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Sprint 3 deliverables" /></Fld>
          <div className="grid grid-cols-3 gap-3">
            <Fld label="Issued"><Input type="date" value={f.issued_at} onChange={(e) => setF({ ...f, issued_at: e.target.value })} /></Fld>
            <Fld label="Due"><Input type="date" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></Fld>
            <Fld label="Tax %"><Input type="number" step="0.01" value={f.tax_rate} onChange={(e) => setF({ ...f, tax_rate: e.target.value })} /></Fld>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Line items</Label>
              <Button type="button" size="sm" variant="ghost" onClick={() => setItems((p) => [...p, { description: "", quantity: "1", unit_price: "0" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add row
              </Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
                <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
                <Input className="col-span-3" type="number" step="0.01" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} />
                <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(subtotal, f.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono">{formatCurrency(taxAmount, f.currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">{formatCurrency(total, f.currency)}</span></div>
          </div>

          <Fld label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Payment instructions, thank-you note…" /></Fld>

          <SheetFooter><Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invoice"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
