"use client";

import { useState } from "react";
import { useMock, type Expense } from "../../../../lib/mock-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { toast } from "sonner";

const COLORS = ["oklch(0.55 0.22 285)", "oklch(0.7 0.16 155)", "oklch(0.7 0.18 60)", "oklch(0.65 0.22 25)", "oklch(0.6 0.18 220)", "oklch(0.7 0.18 320)"];

export default function ExpensesPage() {
  const { expenses, addExpense } = useMock();
  const totalBDT = expenses.filter((e) => e.currency === "BDT").reduce((s, e) => s + e.amount, 0);
  const totalUSD = expenses.filter((e) => e.currency === "USD").reduce((s, e) => s + e.amount, 0);

  const byCat = Object.values(
    expenses.reduce<Record<string, { name: string; value: number }>>((acc, e) => {
      const usdValue = e.currency === "USD" ? e.amount : e.amount / 110;
      if (!acc[e.category]) acc[e.category] = { name: e.category, value: 0 };
      acc[e.category].value += usdValue;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track operational spend across categories and currencies.</p>
        </div>
        <NewExpenseSheet onAdd={addExpense} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total BDT</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalBDT, "BDT")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total USD</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalUSD, "USD")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold mt-1">{byCat.length}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Spend by category</CardTitle><CardDescription>Normalised to USD</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent expenses</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead><TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                    <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                    <TableCell className="text-sm">{e.vendor}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(e.amount, e.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewExpenseSheet({ onAdd }: { onAdd: (e: Omit<Expense, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    category: "Software", vendor: "", description: "", amount: "0",
    currency: "USD" as "BDT" | "USD", date: new Date().toISOString().slice(0, 10),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({ ...f, amount: Number(f.amount) || 0 });
    toast.success("Expense recorded");
    setOpen(false);
    setF((p) => ({ ...p, vendor: "", description: "", amount: "0" }));
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> Record expense</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Record expense</SheetTitle><SheetDescription>Log operational spend.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Category">
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Software", "Office Rent", "Utility", "SEO Tools", "Marketing", "Travel", "Equipment", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
            <Fld label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Fld>
          </div>
          <Fld label="Vendor"><Input required value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Fld>
          <Fld label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Amount"><Input type="number" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BDT">BDT</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <SheetFooter><Button type="submit">Record</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
