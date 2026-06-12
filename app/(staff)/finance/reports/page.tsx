"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Badge } from "../../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import { TrendingUp, DollarSign, Calendar, Users, Briefcase, RefreshCw, ChevronRight, FileText, UserCheck, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../../../lib/format";
import { toast } from "sonner";
import { Skeleton } from "../../../../components/ui/skeleton";

interface PnLData {
  month: string;
  total_income: number;
  total_expense: number;
  net_profit: number;
}

interface ClientDue {
  client_id: string;
  company_name: string;
  total_invoiced_amount: number;
  total_paid_amount: number;
  total_outstanding_due: number;
}

interface FounderEquity {
  founder_name: string;
  total_invested: number;
  total_repaid: number;
  remaining_outstanding_due: number;
}

interface ExpenseBreakdown {
  category: string;
  total_amount: number;
  currency: string;
}

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

export default function FinancialReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Date range filters for expense breakdown
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Raw Database Data
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [clientDues, setClientDues] = useState<ClientDue[]>([]);
  const [founderEquity, setFounderEquity] = useState<FounderEquity[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
    
    void loadReportsData(
      thirtyDaysAgo.toISOString().split("T")[0], 
      today.toISOString().split("T")[0]
    );
  }, []);

  async function loadReportsData(start: string, end: string) {
    setLoading(true);
    try {
      // 1. Fetch view_monthly_pnl (PNL)
      const { data: pnlRes, error: pnlErr } = await supabase
        .from("view_monthly_pnl" as any)
        .select("*")
        .limit(12); // Last 12 months
      
      if (pnlErr) throw pnlErr;
      
      // Reverse P&L data to keep months chronological (ascending)
      const formattedPnl = (pnlRes || []).map((p: any) => ({
        month: p.month,
        total_income: Number(p.total_income),
        total_expense: Number(p.total_expense),
        net_profit: Number(p.net_profit)
      })).reverse();
      setPnlData(formattedPnl);

      // 2. Fetch view_client_dues
      const { data: duesRes, error: duesErr } = await supabase
        .from("view_client_dues" as any)
        .select("*")
        .order("total_outstanding_due", { ascending: false });
      
      if (duesErr) throw duesErr;
      setClientDues((duesRes || []).map((d: any) => ({
        client_id: d.client_id,
        company_name: d.company_name,
        total_invoiced_amount: Number(d.total_invoiced_amount),
        total_paid_amount: Number(d.total_paid_amount),
        total_outstanding_due: Number(d.total_outstanding_due)
      })));

      // 3. Fetch view_founder_equity
      const { data: equityRes, error: eqErr } = await supabase
        .from("view_founder_equity" as any)
        .select("*");
      
      if (eqErr) throw eqErr;
      setFounderEquity((equityRes || []).map((e: any) => ({
        founder_name: e.founder_name,
        total_invested: Number(e.total_invested),
        total_repaid: Number(e.total_repaid),
        remaining_outstanding_due: Number(e.remaining_outstanding_due)
      })));

      // 4. Fetch Expense Breakdown RPC
      const { data: expenseRes, error: expErr } = await (supabase as any)
        .rpc("get_expense_breakdown", { 
          start_date: start, 
          end_date: end 
        });

      if (expErr) throw expErr;
      setExpenseBreakdown(((expenseRes as any[]) || []).map((x: any) => ({
        category: x.category,
        total_amount: Number(x.total_amount),
        currency: x.currency
      })));

    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve analytical reports data");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return toast.error("Please enter a valid date range");
    void loadReportsData(startDate, endDate);
  }

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalDuesBDT = clientDues.reduce((s, c) => s + c.total_outstanding_due, 0);
    let totalEquityDueBDT = founderEquity.reduce((s, f) => s + f.remaining_outstanding_due, 0);
    
    // Net profit for latest recorded month
    const currentMonthData = pnlData[pnlData.length - 1];
    
    return {
      totalDuesBDT,
      totalEquityDueBDT,
      currentMonthIncome: currentMonthData?.total_income || 0,
      currentMonthExpense: currentMonthData?.total_expense || 0,
      currentMonthNet: currentMonthData?.net_profit || 0
    };
  }, [clientDues, founderEquity, pnlData]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            Real-time business performance analytics, P&L trends, outstanding dues, and expenses breakdown.
          </p>
        </div>
        <Button onClick={() => void loadReportsData(startDate, endDate)} disabled={loading} variant="outline" size="icon" className="shrink-0 cursor-pointer">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* KPI Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Client Dues</p>
              <p className="text-2xl font-bold text-rose-500">{formatCurrency(aggregateStats.totalDuesBDT, "BDT")}</p>
              <p className="text-[10px] text-muted-foreground">Unpaid customer invoices</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Founder Dues</p>
              <p className="text-2xl font-bold text-amber-500">{formatCurrency(aggregateStats.totalEquityDueBDT, "BDT")}</p>
              <p className="text-[10px] text-muted-foreground">Owed to Ismail & Imtiaz</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Month Revenue</p>
              <p className="text-2xl font-bold text-emerald-500">{formatCurrency(aggregateStats.currentMonthIncome, "BDT")}</p>
              <p className="text-[10px] text-muted-foreground">Earned this month</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border/50">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Month Net PNL</p>
              <p className={`text-2xl font-bold ${aggregateStats.currentMonthNet >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {formatCurrency(aggregateStats.currentMonthNet, "BDT")}
              </p>
              <p className="text-[10px] text-muted-foreground">Revenue minus operating expenses</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PNL Trend Area Chart */}
        <Card className="lg:col-span-2 bg-card/45 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-bold">Income vs Operating Expenses</CardTitle>
              <CardDescription>Monthly cashflow trends over the last 12 months</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : pnlData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground italic text-xs">
                No monthly data recorded yet. Record transactions to view trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="month" className="text-[10px] fill-muted-foreground" />
                  <YAxis className="text-[10px] fill-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Area
                    type="monotone"
                    dataKey="total_income"
                    name="Income"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="total_expense"
                    name="Expense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown Pie Chart */}
        <Card className="bg-card/45 border-border/50 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Expenses by Category</CardTitle>
            <CardDescription>Date range breakdown (Pie representation)</CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col justify-center space-y-4">
            {/* Filter Form inside Pie Chart Card */}
            <form onSubmit={handleFilterSubmit} className="grid grid-cols-2 gap-2 border-b pb-4 mb-2">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase font-bold text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-[11px] px-2 shadow-none"
                />
              </div>
              <div className="space-y-1 flex items-end gap-1">
                <div className="flex-1">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-[11px] px-2 shadow-none"
                  />
                </div>
                <Button type="submit" size="sm" className="h-8 px-2 cursor-pointer shadow-none">
                  Go
                </Button>
              </div>
            </form>

            {loading ? (
              <Skeleton className="h-[180px] w-[180px] rounded-full mx-auto" />
            ) : expenseBreakdown.length === 0 ? (
              <div className="text-center text-muted-foreground italic text-xs py-12">
                No expenses found for this date range.
              </div>
            ) : (
              <>
                <div className="h-[180px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="total_amount"
                        nameKey="category"
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v || 0), "BDT")} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Labels Legend Grid */}
                <div className="max-h-28 overflow-y-auto space-y-1.5 text-[10px] pr-1">
                  {expenseBreakdown.map((d, index) => (
                    <div key={d.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="capitalize truncate font-medium text-muted-foreground">{d.category.replace("_", " ")}</span>
                      </div>
                      <span className="font-bold text-foreground pl-2">{formatCurrency(d.total_amount, "BDT")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Dues Directory Card */}
      <Card className="bg-card/45 border-border/50">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Client Outstanding Dues</CardTitle>
            <CardDescription>Directory of all clients with unpaid invoices and pending balances.</CardDescription>
          </div>
          <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">
            Total Dues: {formatCurrency(aggregateStats.totalDuesBDT, "BDT")}
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : clientDues.filter(c => c.total_outstanding_due > 0).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground italic text-xs">
              Excellent! No clients currently have outstanding dues.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Client Company Name</th>
                  <th className="p-4 text-right">Total Invoiced</th>
                  <th className="p-4 text-right">Total Paid Amount</th>
                  <th className="p-4 text-right font-bold text-rose-500">Outstanding Due</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b">
                {clientDues
                  .filter((c) => c.total_outstanding_due > 0)
                  .map((c) => (
                    <tr key={c.client_id} className="hover:bg-muted/10">
                      <td className="p-4 font-bold text-foreground">{c.company_name}</td>
                      <td className="p-4 text-right">{formatCurrency(c.total_invoiced_amount, "BDT")}</td>
                      <td className="p-4 text-right">{formatCurrency(c.total_paid_amount, "BDT")}</td>
                      <td className="p-4 text-right font-extrabold text-rose-500">{formatCurrency(c.total_outstanding_due, "BDT")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
