"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { 
  Bell, Calendar, AlertTriangle, AlertCircle, CheckCircle, 
  Edit, Trash2, Plus, ExternalLink, Loader2, Copy, Check,
  Search, DollarSign, RefreshCw, Zap, Globe, Database, Server, CreditCard, Clock
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../../../lib/format";
import { TableSkeleton } from "../../../components/loading-skeletons";
import { FlatDatePicker } from "../../../components/ui/flat-date-picker";
import { FlatTimePicker } from "../../../components/ui/flat-time-picker";

type CategoryType = "utility" | "domain" | "vps" | "hosting" | "subscription" | "other";

interface ClientFolder {
  id: string;
  company_name: string;
}

interface BillingReminder {
  id: string;
  name: string;
  category: CategoryType;
  provider: string;
  cost: number;
  currency: "BDT" | "USD";
  due_date: string;
  due_time: string | null;
  billing_cycle: "monthly" | "quarterly" | "yearly" | "one-time";
  auto_renew: boolean;
  client_id: string | null;
  company_name: string;
  reminder_days: number;
  reminder_value: number;
  reminder_unit: string;
  domain_id: string | null;
  notes: string;
  created_by_name: string;
  created_at: string;
}

const CATEGORY_ICONS: Record<CategoryType, typeof Globe> = {
  utility: Zap,
  domain: Globe,
  vps: Database,
  hosting: Server,
  subscription: CreditCard,
  other: Clock,
};

const CATEGORY_COLORS: Record<CategoryType, string> = {
  utility: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  domain: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  vps: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  hosting: "text-teal-500 bg-teal-500/10 border-teal-500/20",
  subscription: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  other: "text-slate-500 bg-slate-500/10 border-slate-500/20",
};

export default function RemindersPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

  const [reminders, setReminders] = useState<BillingReminder[]>([]);
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<"all" | CategoryType>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "overdue" | "soon" | "active">("all");
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Form sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<BillingReminder | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryType>("utility");
  const [provider, setProvider] = useState("");
  const [cost, setCost] = useState("0");
  const [currency, setCurrency] = useState<"BDT" | "USD">("BDT");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "quarterly" | "yearly" | "one-time">("monthly");
  const [autoRenew, setAutoRenew] = useState(false);
  const [clientId, setClientId] = useState<string>("personal");
  const [reminderValue, setReminderValue] = useState("7");
  const [reminderUnit, setReminderUnit] = useState<"minutes" | "hours" | "days">("days");
  const [domainId, setDomainId] = useState<string>("none");
  const [domainsList, setDomainsList] = useState<{ id: string; domain_name: string }[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [notes, setNotes] = useState("");

  const calendarFeedUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/reminders/feed?token=cnit_reminders_key_2026` 
    : "";

  useEffect(() => {
    void loadReminders();
    void loadFolders();
    void loadDomainsList();
  }, []);

  async function fetchWithAuth(urlStr: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(urlStr, { ...options, headers });
  }

  async function loadReminders() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/reminders");
      if (!res.ok) throw new Error("Failed to load reminders data");
      const data = await res.json();
      setReminders(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load reminder items");
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders() {
    setFoldersLoading(true);
    try {
      const res = await fetchWithAuth("/api/vault/folders");
      if (res.ok) {
        const data = await res.json();
        setFolders(data || []);
      }
    } catch (err) {
      console.error("Error loading folders:", err);
    } finally {
      setFoldersLoading(false);
    }
  }

  async function loadDomainsList() {
    setDomainsLoading(true);
    try {
      const res = await fetchWithAuth("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomainsList(data || []);
      }
    } catch (err) {
      console.error("Error loading domains list:", err);
    } finally {
      setDomainsLoading(false);
    }
  }


  const getRemainingTimeText = (dateStr: string, timeStr: string | null) => {
    const now = new Date();
    let dueTimestamp: Date;
    if (timeStr) {
      dueTimestamp = new Date(`${dateStr}T${timeStr}`);
    } else {
      dueTimestamp = new Date(`${dateStr}T23:59:59`);
    }

    const diffMs = dueTimestamp.getTime() - now.getTime();
    if (diffMs < 0) {
      const days = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return { status: "overdue", text: `${days > 0 ? `${days}d` : "hours"} Overdue` };
    }

    const diffMin = Math.ceil(diffMs / (1000 * 60));
    if (diffMin === 0) {
      return { status: "due_today", text: "Due Now" };
    }

    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      if (diffHours <= 1) {
        return { status: "soon", text: `${diffMin}m left` };
      }
      return { status: "soon", text: `${diffHours}h left` };
    }

    return { status: "active", text: `${diffDays} days left` };
  };

  const isSoon = (r: BillingReminder) => {
    const now = new Date();
    let dueTimestamp: Date;
    if (r.due_time) {
      dueTimestamp = new Date(`${r.due_date}T${r.due_time}`);
    } else {
      dueTimestamp = new Date(`${r.due_date}T23:59:59`);
    }

    const diffMs = dueTimestamp.getTime() - now.getTime();
    if (diffMs < 0) return false;

    const val = r.reminder_value;
    const unit = r.reminder_unit;

    let diffUnits = 0;
    if (unit === "minutes") {
      diffUnits = diffMs / (1000 * 60);
    } else if (unit === "hours") {
      diffUnits = diffMs / (1000 * 60 * 60);
    } else {
      diffUnits = diffMs / (1000 * 60 * 60 * 24);
    }

    return diffUnits <= val;
  };

  // KPI Calculations
  const stats = useMemo(() => {
    let total = reminders.length;
    let overdue = 0;
    let dueSoon = 0;
    let monthlyCostBDT = 0;
    let monthlyCostUSD = 0;

    reminders.forEach(r => {
      const remaining = getRemainingTimeText(r.due_date, r.due_time);
      if (remaining.status === "overdue") overdue++;
      else if (isSoon(r)) dueSoon++;

      // Project estimate monthly OpEx
      let factor = 1;
      if (r.billing_cycle === "yearly") factor = 1 / 12;
      else if (r.billing_cycle === "quarterly") factor = 1 / 3;
      else if (r.billing_cycle === "one-time") factor = 0;

      const costValue = (r.cost || 0) * factor;
      if (r.currency === "USD") {
        monthlyCostUSD += costValue;
      } else {
        monthlyCostBDT += costValue;
      }
    });

    return { total, overdue, dueSoon, monthlyCostBDT, monthlyCostUSD };
  }, [reminders]);

  // Filters mapping
  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q.toLowerCase()) ||
        r.provider.toLowerCase().includes(q.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(q.toLowerCase()));

      const matchesCategory =
        selectedCategoryFilter === "all" ||
        r.category === selectedCategoryFilter;

      const remaining = getRemainingTimeText(r.due_date, r.due_time);
      const isOverdue = remaining.status === "overdue";
      const isDueSoon = isSoon(r);

      const matchesStatus =
        selectedStatusFilter === "all" ||
        (selectedStatusFilter === "overdue" && isOverdue) ||
        (selectedStatusFilter === "soon" && isDueSoon) ||
        (selectedStatusFilter === "active" && !isOverdue && !isDueSoon);

      return matchesQ && matchesCategory && matchesStatus;
    });
  }, [reminders, q, selectedCategoryFilter, selectedStatusFilter]);

  const openAddSheet = () => {
    setEditingReminder(null);
    setName("");
    setCategory("utility");
    setProvider("");
    setCost("0");
    setCurrency("BDT");
    setDueDate("");
    setDueTime("");
    setBillingCycle("monthly");
    setAutoRenew(false);
    setClientId("personal");
    setReminderValue("7");
    setReminderUnit("days");
    setDomainId("none");
    setNotes("");
    setFormOpen(true);
  };

  const openEditSheet = (r: BillingReminder) => {
    setEditingReminder(r);
    setName(r.name);
    setCategory(r.category);
    setProvider(r.provider);
    setCost(r.cost.toString());
    setCurrency(r.currency);
    setDueDate(r.due_date);
    setDueTime(r.due_time || "");
    setBillingCycle(r.billing_cycle);
    setAutoRenew(r.auto_renew);
    setClientId(r.client_id || "personal");
    setReminderValue((r.reminder_value ?? r.reminder_days ?? 7).toString());
    setReminderUnit((r.reminder_unit || "days") as any);
    setDomainId(r.domain_id || "none");
    setNotes(r.notes);
    setFormOpen(true);
  };


  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Reminder name is required");
    if (!dueDate) return toast.error("Due date is required");

    setFormSubmitting(true);
    try {
      const payload = {
        name,
        category,
        provider,
        cost: parseFloat(cost) || 0.00,
        currency,
        due_date: dueDate,
        due_time: dueTime || null,
        billing_cycle: billingCycle,
        auto_renew: autoRenew,
        client_id: clientId === "personal" ? null : clientId,
        reminder_value: parseInt(reminderValue, 10) || 7,
        reminder_unit: reminderUnit,
        domain_id: domainId === "none" ? null : domainId,
        notes
      };


      let res;
      if (editingReminder) {
        res = await fetchWithAuth("/api/reminders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingReminder.id, ...payload })
        });
      } else {
        res = await fetchWithAuth("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submitting data failed");
      }

      toast.success(editingReminder ? "Reminder updated successfully" : "Reminder created successfully");
      setFormOpen(false);
      void loadReminders();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit reminder");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    const toastId = toast.loading("Updating payment status...");
    try {
      const res = await fetchWithAuth("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "mark_paid" })
      });

      if (!res.ok) throw new Error("Failed to mark as paid");
      const resData = await res.json();
      
      toast.success(`Payment recorded! Next due date: ${resData.next_due_date}`, { id: toastId });
      void loadReminders();
    } catch (err: any) {
      toast.error(err.message || "Error updating payment status", { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    const toastId = toast.loading("Deleting reminder...");
    try {
      const res = await fetchWithAuth(`/api/reminders?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Reminder deleted", { id: toastId });
      void loadReminders();
    } catch (err: any) {
      toast.error(err.message || "Error deleting reminder", { id: toastId });
    }
  };

  const handleCopyToClipboard = () => {
    if (!calendarFeedUrl) return;
    navigator.clipboard.writeText(calendarFeedUrl);
    setCopiedFeed(true);
    toast.success("Live iCal subscription URL copied to clipboard!");
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  const getGoogleCalendarUrl = (r: BillingReminder) => {
    const dueYMD = r.due_date.replace(/-/g, "");
    let datesParam = "";
    
    if (r.due_time) {
      const cleanTime = r.due_time.replace(/:/g, "").padEnd(6, "0").substring(0, 6);
      const startParam = `${dueYMD}T${cleanTime}`;
      
      // End date time is 1 hour later
      const timeParts = r.due_time.split(":");
      let hours = parseInt(timeParts[0], 10) || 0;
      let minutes = parseInt(timeParts[1], 10) || 0;
      hours = (hours + 1) % 24;
      const endCleanTime = `${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}00`;
      const endParam = `${dueYMD}T${endCleanTime}`;
      
      datesParam = `${startParam}/${endParam}`;
    } else {
      // All-day: start is dueYMD, end is due_date + 1 day
      const end = new Date(r.due_date);
      end.setDate(end.getDate() + 1);
      const endYMD = end.toISOString().split("T")[0].replace(/-/g, "");
      datesParam = `${dueYMD}/${endYMD}`;
    }

    const text = encodeURIComponent(`[CNIT Bill] ${r.name}`);
    const details = encodeURIComponent(
      `Category: ${r.category}\n` +
      `Cost: ${r.cost} ${r.currency}\n` +
      `Billing Cycle: ${r.billing_cycle}\n` +
      `Provider: ${r.provider || "—"}\n` +
      `Notes: ${r.notes || "—"}`
    );
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${datesParam}&details=${details}&sf=true&output=xml&ctz=Asia/Dhaka`;
  };

  function expiryBadge(r: BillingReminder) {
    const { status, text } = getRemainingTimeText(r.due_date, r.due_time);
    if (status === "overdue") {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertCircle className="h-3 w-3 mr-1" /> {text}
        </Badge>
      );
    }
    if (status === "due_today") {
      return (
        <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600">
          Due Today
        </Badge>
      );
    }
    if (isSoon(r)) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" /> {text}
        </Badge>
      );
    }
    return <Badge variant="secondary" className="text-slate-600 dark:text-slate-300">{text}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders & Renewals</h1>
          <p className="text-muted-foreground mt-1">Track utility bills, office renewals, client domains, and hosting cycles.</p>
        </div>
        {isAdmin && (
          <Button onClick={openAddSheet} className="shadow-elegant gradient-primary">
            <Plus className="h-4 w-4 mr-1.5" /> Add Reminder
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/45 border-border/50 shadow-sm"><CardContent className="p-5">
          <div className="flex justify-between items-center text-muted-foreground text-xs uppercase tracking-wider">
            <span>Total Active Reminders</span>
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </CardContent></Card>

        <Card className={`bg-card/45 border-border/50 shadow-sm transition-all duration-300 ${stats.overdue > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}><CardContent className="p-5">
          <div className="flex justify-between items-center text-muted-foreground text-xs uppercase tracking-wider">
            <span>Overdue Bills</span>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <p className={`text-3xl font-bold mt-2 ${stats.overdue > 0 ? "text-destructive" : ""}`}>{stats.overdue}</p>
        </CardContent></Card>

        <Card className={`bg-card/45 border-border/50 shadow-sm transition-all duration-300 ${stats.dueSoon > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}><CardContent className="p-5">
          <div className="flex justify-between items-center text-muted-foreground text-xs uppercase tracking-wider">
            <span>Due Within 7 Days</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`text-3xl font-bold mt-2 ${stats.dueSoon > 0 ? "text-amber-500" : ""}`}>{stats.dueSoon}</p>
        </CardContent></Card>

        <Card className="bg-card/45 border-border/50 shadow-sm"><CardContent className="p-5">
          <div className="flex justify-between items-center text-muted-foreground text-xs uppercase tracking-wider">
            <span>Est. Monthly OpEx</span>
            <DollarSign className="h-4 w-4 text-teal-500" />
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-xl font-bold font-mono">{formatCurrency(stats.monthlyCostBDT, "BDT")}</p>
            <p className="text-xs text-muted-foreground font-mono">+{formatCurrency(stats.monthlyCostUSD, "USD")}</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Google Calendar Sync Center */}
      <Card className="border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/10 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="bg-indigo-600 text-white p-6 flex flex-col justify-center items-center text-center md:w-56 shrink-0">
            <Calendar className="h-8 w-8 mb-2 animate-bounce" />
            <h3 className="font-bold text-sm">Google Calendar</h3>
            <p className="text-[10px] text-indigo-200 mt-1">Live Feed Sync</p>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-foreground">Sync your reminders with Google Calendar</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add this live calendar subscription URL to your Google Calendar to track office utility bills and hosting expiries automatically.
              </p>
            </div>
            
            <div className="mt-4 flex gap-2 max-w-2xl flex-col sm:flex-row items-stretch sm:items-center">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  readOnly 
                  value={calendarFeedUrl} 
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 pr-10 text-xs font-mono text-muted-foreground select-all outline-none"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <Badge variant="outline" className="text-[9px] bg-background/50 border-indigo-200 text-indigo-600 dark:text-indigo-400">ICS Feed</Badge>
                </div>
              </div>
              <Button onClick={handleCopyToClipboard} size="sm" className="gradient-primary">
                {copiedFeed ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {copiedFeed ? "Copied" : "Copy Link"}
              </Button>
            </div>

            <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              <span><strong>Instructions:</strong> Open Google Calendar &gt; Click "+" next to "Other calendars" &gt; Select "From URL" &gt; Paste link.</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Search reminders by name or notes..." 
            className="pl-9 bg-card border-border shadow-sm" 
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <Select value={selectedCategoryFilter} onValueChange={(v) => setSelectedCategoryFilter(v as any)}>
            <SelectTrigger className="w-[150px] bg-card border-border shadow-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="utility">Utility Bills</SelectItem>
              <SelectItem value="domain">Domains</SelectItem>
              <SelectItem value="vps">VPS/Cloud</SelectItem>
              <SelectItem value="hosting">Web Hosting</SelectItem>
              <SelectItem value="subscription">Subscriptions</SelectItem>
              <SelectItem value="other">Other Expiries</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatusFilter} onValueChange={(v) => setSelectedStatusFilter(v as any)}>
            <SelectTrigger className="w-[140px] bg-card border-border shadow-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="soon">Due Soon</SelectItem>
              <SelectItem value="active">Upcoming</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={loadReminders} title="Refresh lists">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <Card className="bg-card/45 border-border/50 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[220px]">Reminder Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Client/Company</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Billing Cycle</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReminders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-16">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-30 animate-pulse text-indigo-500" />
                    <p className="font-semibold text-sm">No reminders found</p>
                    <p className="text-xs mt-1 text-muted-foreground/75">Create a reminder or modify filters to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReminders.map((r) => {
                  const Icon = CATEGORY_ICONS[r.category] || Clock;
                  const remaining = getRemainingTimeText(r.due_date, r.due_time);
                  const isOverdue = remaining.status === "overdue";

                  
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg border ${CATEGORY_COLORS[r.category] || ""}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="truncate max-w-[160px]" title={r.name}>{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs font-normal">
                          {r.category === "vps" ? "VPS/Cloud" : r.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {r.company_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.provider || "—"}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(Number(r.cost), r.currency)}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{r.billing_cycle}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatDate(r.due_date)}
                        {r.due_time && <span className="text-[10px] text-muted-foreground block font-normal">{r.due_time.substring(0, 5)}</span>}
                      </TableCell>
                      <TableCell>{expiryBadge(r)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Add to Google Calendar Template Link */}
                          <Button 
                            asChild 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50"
                            title="Add to Google Calendar"
                          >
                            <a href={getGoogleCalendarUrl(r)} target="_blank" rel="noopener noreferrer">
                              <Calendar className="h-4 w-4" />
                            </a>
                          </Button>

                          {/* Quick Mark Paid */}
                          {isAdmin && (
                            <Button
                              onClick={() => handleMarkPaid(r.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                              title="Mark as Paid & Roll Forward Date"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Edit Details */}
                          {isAdmin && (
                            <Button
                              onClick={() => openEditSheet(r)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5"
                              title="Edit Details"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Delete */}
                          {isAdmin && (
                            <Button
                              onClick={() => handleDelete(r.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                              title="Delete Reminder"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Reminder Sheet Form */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex flex-col h-full p-0 w-full sm:max-w-lg">
          <div className="py-3 px-6 border-b border-border/40 shrink-0">
            <SheetHeader>
              <SheetTitle>{editingReminder ? "Edit Reminder Details" : "Create New Renewal/Bill Reminder"}</SheetTitle>
              <SheetDescription>
                {editingReminder ? "Modify the properties of this billing item." : "Create an active tracking item for utility bills or infrastructure renewals."}
              </SheetDescription>
            </SheetHeader>
          </div>
          
          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <Fld label="Item Name (e.g. Office Electricity Bill, CNIT official domain)">
                <Input 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Electricity Bill" 
                />
              </Fld>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Category">
                  <Select value={category} onValueChange={(v) => setCategory(v as CategoryType)}>
                    <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility" className="cursor-pointer">Utility Bill</SelectItem>
                      <SelectItem value="domain" className="cursor-pointer">Domain Registration</SelectItem>
                      <SelectItem value="vps" className="cursor-pointer">VPS/Cloud Instance</SelectItem>
                      <SelectItem value="hosting" className="cursor-pointer">Web Hosting</SelectItem>
                      <SelectItem value="subscription" className="cursor-pointer">SaaS Subscription</SelectItem>
                      <SelectItem value="other" className="cursor-pointer">Other Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                </Fld>
                
                <Fld label="Provider / Registrar">
                  <Input 
                    value={provider} 
                    onChange={(e) => setProvider(e.target.value)} 
                    placeholder="e.g. DPDC, Namecheap, DigitalOcean" 
                  />
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Estimated Cost">
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={cost} 
                    onChange={(e) => setCost(e.target.value)} 
                  />
                </Fld>

                <Fld label="Currency">
                  <Select value={currency} onValueChange={(v) => setCurrency(v as "BDT" | "USD")}>
                    <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BDT" className="cursor-pointer">BDT (৳)</SelectItem>
                      <SelectItem value="USD" className="cursor-pointer">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Due Date">
                  <FlatDatePicker
                    date={dueDate}
                    onChange={(d) => setDueDate(d)}
                    placeholder="Select due date"
                  />
                </Fld>

                <Fld label="Due Time (Optional)">
                  <FlatTimePicker
                    value={dueTime}
                    onChange={(t) => setDueTime(t)}
                    placeholder="Select time"
                  />
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Billing Frequency">
                  <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as any)}>
                    <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly" className="cursor-pointer">Monthly</SelectItem>
                      <SelectItem value="quarterly" className="cursor-pointer">Quarterly</SelectItem>
                      <SelectItem value="yearly" className="cursor-pointer">Yearly</SelectItem>
                      <SelectItem value="one-time" className="cursor-pointer">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </Fld>

                <Fld label="Reminder Alert">
                  <div className="flex gap-1.5">
                    <Input 
                      type="number" 
                      value={reminderValue} 
                      onChange={(e) => setReminderValue(e.target.value)} 
                      className="w-16 px-1.5 text-center shrink-0"
                      placeholder="7" 
                    />
                    <Select value={reminderUnit} onValueChange={(v) => setReminderUnit(v as any)}>
                      <SelectTrigger className="flex-1 min-w-[75px] px-1.5 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes" className="cursor-pointer">Mins</SelectItem>
                        <SelectItem value="hours" className="cursor-pointer">Hours</SelectItem>
                        <SelectItem value="days" className="cursor-pointer">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Fld>
              </div>

              <Fld label="Client / Project Association (Optional)">
                <Select value={clientId} onValueChange={(v) => setClientId(v)}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select Client folder" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal" className="cursor-pointer">Internal Office (CNIT IT)</SelectItem>
                    {foldersLoading ? (
                      <SelectItem value="loading" disabled>Loading client list...</SelectItem>
                    ) : (
                      folders.map((c) => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.company_name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </Fld>

              {category === "domain" && (
                <Fld label="Linked Client Domain (Optional — updates domain renewal status automatically)">
                  <Select value={domainId} onValueChange={(v) => setDomainId(v)}>
                    <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select domain to sync" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="cursor-pointer">Not Linked (Standalone Reminder)</SelectItem>
                      {domainsLoading ? (
                        <SelectItem value="loading" disabled>Loading domains...</SelectItem>
                      ) : (
                        domainsList.map((d) => <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.domain_name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </Fld>
              )}

              <Fld label="Notes & payment details">
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Include dynamic details like account numbers, payment link, or renewal keys." 
                  rows={3} 
                />
              </Fld>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  id="autoRenew"
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <Label htmlFor="autoRenew" className="text-xs cursor-pointer text-muted-foreground select-none">
                  Enable auto-debit / auto-renew for this item.
                </Label>
              </div>
            </div>

            <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
              <SheetFooter className="mt-0">
                <Button type="submit" disabled={formSubmitting} className="gradient-primary w-full cursor-pointer">
                  {formSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    editingReminder ? "Update Reminder" : "Create Reminder"
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

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</Label>{children}</div>;
}
