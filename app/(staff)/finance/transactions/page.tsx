"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../../../../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Textarea } from "../../../../components/ui/textarea";
import { ArrowUpRight, ArrowDownRight, Plus, Trash2, Wallet, DollarSign, Calendar, Search, Loader2, User, FileText, CheckCircle2, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import { Skeleton } from "../../../../components/ui/skeleton";

interface Client {
  id: string;
  company_name: string;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: number;
  client_id: string | null;
}

interface Employee {
  id: string;
  full_name: string | null;
}

interface Transaction {
  id: string;
  type: "income" | "expense" | "investment" | "founder_repayment";
  amount: number;
  currency: "BDT" | "USD";
  category: string;
  description: string | null;
  date: string;
  client_id: string | null;
  invoice_id: string | null;
  employee_id: string | null;
  founder_name: "Ismail" | "Imtiaz" | null;
  recorded_by: string | null;
  created_at: string;
  clients?: {
    company_name: string;
  } | null;
  invoices?: {
    number: string;
  } | null;
  employees?: {
    full_name: string | null;
  } | null;
}

interface FounderEquity {
  founder_name: string;
  total_invested: number;
  total_repaid: number;
  remaining_outstanding_due: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [founderEquity, setFounderEquity] = useState<FounderEquity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");

  // Form states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add Transaction fields
  const [type, setType] = useState<"income" | "expense" | "investment" | "founder_repayment">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"BDT" | "USD">("BDT");
  const [category, setCategory] = useState("snacks");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState("none");
  const [invoiceId, setInvoiceId] = useState("none");
  const [employeeId, setEmployeeId] = useState("none");
  const [founderName, setFounderName] = useState<"Ismail" | "Imtiaz" | "none">("none");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch transactions ledger, lookup tables, and analytics concurrently
      const [txResult, feResult, clResult, empResult, invResult] = await Promise.all([
        supabase
          .from("transactions" as any)
          .select(`
            *,
            clients:client_id ( company_name ),
            invoices:invoice_id ( number ),
            employees:employee_id ( full_name )
          `)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("view_founder_equity" as any).select("*"),
        supabase.from("clients").select("id, company_name").order("company_name", { ascending: true }),
        supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
        supabase.from("invoices" as any).select("id, number, title, total, client_id").order("number", { ascending: false })
      ]);

      if (txResult.error) throw txResult.error;
      setTransactions((txResult.data || []) as any[]);

      if (!feResult.error && feResult.data) {
        setFounderEquity(feResult.data as any[]);
      }

      setClients(clResult.data || []);
      setEmployees(empResult.data || []);
      setInvoices((invResult.data as any[] ?? []) as Invoice[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load transactions data");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Are you sure you want to delete this ledger entry?")) return;
    try {
      const { error } = await supabase.from("transactions" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Transaction entry deleted successfully");
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete transaction");
    }
  }

  // Pre-filter categories based on type selection in sheet
  useEffect(() => {
    if (type === "income") {
      setCategory("project_income");
    } else if (type === "expense") {
      setCategory("snacks");
    } else if (type === "investment") {
      setCategory("founder_equity");
    } else if (type === "founder_repayment") {
      setCategory("founder_repayment");
    }
  }, [type]);

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return toast.error("Please enter a valid amount");
    if ((type === "investment" || type === "founder_repayment") && founderName === "none") {
      return toast.error("Please select the founder");
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      type,
      amount: parseFloat(amount),
      currency,
      category,
      description: description.trim() || null,
      date: date || new Date().toISOString().split("T")[0],
      client_id: clientId === "none" ? null : clientId,
      invoice_id: invoiceId === "none" ? null : invoiceId,
      employee_id: employeeId === "none" ? null : employeeId,
      founder_name: founderName === "none" ? null : founderName,
      recorded_by: user?.id || null
    };

    try {
      const { error } = await supabase.from("transactions" as any).insert(payload);
      if (error) throw error;

      toast.success("Ledger entry recorded successfully");
      setIsSheetOpen(false);
      
      // Reset form states
      setAmount("");
      setDescription("");
      setClientId("none");
      setInvoiceId("none");
      setEmployeeId("none");
      setFounderName("none");
      
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  }

  // Quick stats calculations
  const stats = useMemo(() => {
    let incomeBDT = 0;
    let incomeUSD = 0;
    let expenseBDT = 0;
    let expenseUSD = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") {
        if (tx.currency === "BDT") incomeBDT += Number(tx.amount);
        else incomeUSD += Number(tx.amount);
      } else if (tx.type === "expense") {
        if (tx.currency === "BDT") expenseBDT += Number(tx.amount);
        else expenseUSD += Number(tx.amount);
      }
    });

    return {
      incomeBDT,
      incomeUSD,
      expenseBDT,
      expenseUSD,
      netBDT: incomeBDT - expenseBDT,
      netUSD: incomeUSD - expenseUSD
    };
  }, [transactions]);

  // Filters mapping
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesQ =
        !q ||
        (tx.description || "").toLowerCase().includes(q.toLowerCase()) ||
        tx.category.toLowerCase().includes(q.toLowerCase()) ||
        (tx.clients?.company_name || "").toLowerCase().includes(q.toLowerCase());

      const matchesType = typeFilter === "all" || tx.type === typeFilter;

      const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter;

      return matchesQ && matchesType && matchesCategory;
    });
  }, [transactions, q, typeFilter, categoryFilter]);

  // Unique categories list for filters
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map((tx) => tx.category)));
  }, [transactions]);

  // Founder individual calculations
  const ismailDue = founderEquity.find(f => f.founder_name === "Ismail")?.remaining_outstanding_due || 0;
  const imtiazDue = founderEquity.find(f => f.founder_name === "Imtiaz")?.remaining_outstanding_due || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger Transactions</h1>
          <p className="text-muted-foreground mt-1">
            General accounting ledger recording cash flow, salaries, business expenses, and founder investments.
          </p>
        </div>
        <Button onClick={() => { setDate(new Date().toISOString().split("T")[0]); setIsSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Record Transaction
        </Button>
      </div>

      {/* Top Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Incomes</p>
              <p className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.incomeBDT, "BDT")}</p>
              {stats.incomeUSD > 0 && <p className="text-xs text-muted-foreground">+{formatCurrency(stats.incomeUSD, "USD")}</p>}
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <p className="text-2xl font-bold text-rose-500">{formatCurrency(stats.expenseBDT, "BDT")}</p>
              {stats.expenseUSD > 0 && <p className="text-xs text-muted-foreground">+{formatCurrency(stats.expenseUSD, "USD")}</p>}
            </div>
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ismail's Remaining Due</p>
              <p className="text-2xl font-bold text-amber-500">{formatCurrency(ismailDue, "BDT")}</p>
              <p className="text-xs text-muted-foreground">Founder Credit Balance</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <User className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Imtiaz's Remaining Due</p>
              <p className="text-2xl font-bold text-amber-500">{formatCurrency(imtiazDue, "BDT")}</p>
              <p className="text-xs text-muted-foreground">Founder Credit Balance</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <User className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Layout */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="bg-muted/60 border">
            <TabsTrigger value="all" className="cursor-pointer">All Entries</TabsTrigger>
            <TabsTrigger value="income" className="cursor-pointer" onClick={() => setTypeFilter("income")}>Income</TabsTrigger>
            <TabsTrigger value="expense" className="cursor-pointer" onClick={() => setTypeFilter("expense")}>Expenses</TabsTrigger>
            <TabsTrigger value="founders" className="cursor-pointer">Founders Equity</TabsTrigger>
          </TabsList>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ledger details..."
                className="pl-8 h-9 text-xs"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab 1: All Entries / General Table */}
        <TabsContent value="all" className="space-y-4">
          <Card className="bg-card/45 border-border/50">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground italic text-sm">
                  No transaction ledger entries found matching active filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Date</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Reference Link</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b">
                    {filteredTransactions.map((tx) => {
                      let typeBadge = "bg-slate-500/10 text-slate-500 border-slate-500/20";
                      if (tx.type === "income") typeBadge = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                      else if (tx.type === "expense") typeBadge = "bg-rose-500/10 text-rose-500 border-rose-500/20";
                      else if (tx.type === "investment") typeBadge = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                      else if (tx.type === "founder_repayment") typeBadge = "bg-blue-500/10 text-blue-500 border-blue-500/20";

                      return (
                        <tr key={tx.id} className="hover:bg-muted/20">
                          <td className="p-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="p-4">
                            <Badge variant="outline" className={`capitalize ${typeBadge}`}>
                              {tx.type.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="p-4 capitalize whitespace-nowrap">{tx.category.replace("_", " ")}</td>
                          <td className="p-4 min-w-[200px]">
                            <p className="font-medium">{tx.description || "—"}</p>
                            {tx.founder_name && <span className="text-[10px] text-amber-600 font-semibold">Founder: {tx.founder_name}</span>}
                          </td>
                          <td className="p-4 text-muted-foreground whitespace-nowrap">
                            {tx.clients && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {tx.clients.company_name}</span>}
                            {tx.invoices && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Invoice {tx.invoices.number}</span>}
                            {tx.employees && <span className="flex items-center gap-1"><User className="h-3 w-3" /> Salary: {tx.employees.full_name}</span>}
                          </td>
                          <td className={`p-4 text-right font-bold whitespace-nowrap text-sm ${tx.type === "income" ? "text-emerald-500" : tx.type === "expense" ? "text-rose-500" : "text-foreground"}`}>
                            {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""} {formatCurrency(tx.amount, tx.currency)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTransaction(tx.id)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/15 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Founders Equity Ledger View */}
        <TabsContent value="founders" className="space-y-6">
          {/* Equity Breakdown Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {["Ismail", "Imtiaz"].map((founder) => {
              const eq = founderEquity.find(f => f.founder_name === founder) || {
                founder_name: founder,
                total_invested: 0,
                total_repaid: 0,
                remaining_outstanding_due: 0
              };

              return (
                <Card key={founder} className="bg-card/45 border-border/50">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" /> {founder}'s Equity Summary
                    </CardTitle>
                    <CardDescription>Aggregate investment ledger and outstanding payback tracking.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase">Total Invested</span>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(eq.total_invested, "BDT")}</p>
                      </div>
                      <div className="space-y-1 border-x px-2">
                        <span className="text-[10px] text-muted-foreground uppercase">Total Repaid</span>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(eq.total_repaid, "BDT")}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-primary uppercase font-bold flex justify-center items-center gap-0.5">
                          Remaining Due
                        </span>
                        <p className="text-base font-extrabold text-amber-500">{formatCurrency(eq.remaining_outstanding_due, "BDT")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Table of only Founder Investments/Repayments */}
          <Card className="bg-card/45 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Historical Founder Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Date</th>
                      <th className="p-4">Founder</th>
                      <th className="p-4">Entry Mode</th>
                      <th className="p-4">Details</th>
                      <th className="p-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions
                      .filter((tx) => tx.founder_name !== null)
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/10">
                          <td className="p-4">{formatDate(tx.date)}</td>
                          <td className="p-4 font-bold text-foreground">{tx.founder_name}</td>
                          <td className="p-4">
                            <Badge variant="outline" className={tx.type === "investment" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}>
                              {tx.type === "investment" ? "Out-of-Pocket Invest" : "Repayment Due"}
                            </Badge>
                          </td>
                          <td className="p-4">{tx.description}</td>
                          <td className={`p-4 text-right font-extrabold ${tx.type === "investment" ? "text-amber-500" : "text-blue-500"}`}>
                            {formatCurrency(tx.amount, tx.currency)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Transaction Sheet Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md flex flex-col h-full p-0">
          <div className="py-4 px-6 border-b shrink-0">
            <SheetHeader>
              <SheetTitle>Record Ledger Transaction</SheetTitle>
              <SheetDescription>
                Manually record general expenses, incoming invoice receipts, salary payouts, or founder investments.
              </SheetDescription>
            </SheetHeader>
          </div>

          <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Type Select */}
              <div className="space-y-1.5">
                <Label htmlFor="txType" className="text-xs font-semibold">Transaction Type *</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger id="txType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense (Outflow)</SelectItem>
                    <SelectItem value="income">Income (Inflow)</SelectItem>
                    <SelectItem value="investment">Founder Investment (Credit)</SelectItem>
                    <SelectItem value="founder_repayment">Founder Repayment (Debit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="txAmount" className="text-xs font-semibold">Amount *</Label>
                  <Input
                    id="txAmount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txCurrency" className="text-xs font-semibold">Currency</Label>
                  <Select value={currency} onValueChange={(v: any) => setCurrency(v)}>
                    <SelectTrigger id="txCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BDT">BDT</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category Select */}
              <div className="space-y-1.5">
                <Label htmlFor="txCategory" className="text-xs font-semibold">Category *</Label>
                {type === "expense" ? (
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="txCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snacks">Snacks & Refreshment</SelectItem>
                      <SelectItem value="office_rent">Office Rent</SelectItem>
                      <SelectItem value="utility">Utility Bills (Electricity, Net)</SelectItem>
                      <SelectItem value="software_license">Software & Tools Subscriptions</SelectItem>
                      <SelectItem value="domain_renewal">Domain & Hosting renewal</SelectItem>
                      <SelectItem value="salary">Employee Payroll Expense</SelectItem>
                      <SelectItem value="marketing">Marketing & Ads</SelectItem>
                      <SelectItem value="equipment">Office Equipment / Hardware</SelectItem>
                      <SelectItem value="travel">Travel Expenses</SelectItem>
                      <SelectItem value="other">Other Expense Category</SelectItem>
                    </SelectContent>
                  </Select>
                ) : type === "income" ? (
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="txCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_income">Project Milestones Payments</SelectItem>
                      <SelectItem value="retainer">Monthly Retainer Inflow</SelectItem>
                      <SelectItem value="training_fees">Training Fees</SelectItem>
                      <SelectItem value="other">Other Service Income</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="txCategory"
                    value={category}
                    disabled
                    className="bg-muted text-muted-foreground text-xs"
                  />
                )}
              </div>

              {/* Date selection */}
              <div className="space-y-1.5">
                <Label htmlFor="txDate" className="text-xs font-semibold">Transaction Date</Label>
                <Input
                  id="txDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Conditional options for Founders */}
              {(type === "investment" || type === "founder_repayment") && (
                <div className="space-y-1.5 bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl">
                  <Label htmlFor="txFounder" className="text-xs font-semibold text-amber-700 dark:text-amber-500">Founder Account *</Label>
                  <Select value={founderName} onValueChange={(v: any) => setFounderName(v)}>
                    <SelectTrigger id="txFounder" className="border-amber-500/20 bg-background">
                      <SelectValue placeholder="Select Founder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ismail">Ismail</SelectItem>
                      <SelectItem value="Imtiaz">Imtiaz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Conditional options for Incomes */}
              {type === "income" && (
                <div className="grid grid-cols-2 gap-3 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Client Reference</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="No Client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Client</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Invoice Reference</Label>
                    <Select value={invoiceId} onValueChange={setInvoiceId}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="No Invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Invoice</SelectItem>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>{inv.number} ({inv.total})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="txDesc" className="text-xs font-semibold">Ledger Memo / Details</Label>
                <Textarea
                  id="txDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes, specific references, purpose details, bank reference numbers etc."
                  rows={3}
                />
              </div>

            </div>

            {/* Form actions */}
            <div className="py-4 px-6 border-t shrink-0 bg-card/50">
              <SheetFooter>
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto cursor-pointer">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    "Record Entry"
                  )}
                </Button>
              </SheetFooter>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
