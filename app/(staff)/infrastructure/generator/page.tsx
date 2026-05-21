"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Zap, Fuel, Wrench, History, Plus, Loader2, Calendar, TrendingUp, Coins, Gauge,
  Edit, Trash2, Settings, Clipboard, Check, Activity, Clock, AlertTriangle, AlertCircle, Copy, UserCheck,
  ChevronLeft, ChevronRight, Eye
} from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { cn } from "../../../../lib/utils";
import { toast } from "sonner";
import { FlatDatePicker } from "../../../../components/ui/flat-date-picker";
import { FlatTimePicker } from "../../../../components/ui/flat-time-picker";
import { TableSkeleton } from "../../../../components/loading-skeletons";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Cast typed supabase client to any to bypass local schema type restrictions for new tables
const supabaseClient = supabase as any;

// Interfaces matching PostgreSQL tables
interface Generator {
  id: string;
  name: string;
  model: string | null;
  capacity: string | null;
  fuel_type: "diesel" | "octane" | "petrol";
  fuel_capacity: number;
  current_hours: number;
  status: "active" | "maintenance" | "standby" | "broken";
  notes: string | null;
}

interface RunLog {
  id: string;
  generator_id: string;
  started_at: string;
  stopped_at: string | null;
  date: string;                       // "YYYY-MM-DD"
  on_time: string;                    // "10:00 pm"
  off_time: string;                   // "10:35 pm"
  duration_minutes: number | null;    // runtime in minutes
  operator_name: string;              // Operator name (Arafat, Shanto, etc.)
  signed_by_name: string | null;      // Approved / Signed by
  purpose: "outage" | "testing" | "maintenance";
  notes: string | null;
  generators?: { name: string };
}

interface RefuelingLog {
  id: string;
  generator_id: string;
  refueled_at: string;
  item_type: string;                  // petrol, mobil, octane, diesel
  liters_added: number;
  cost: number;
  currency: "BDT" | "USD";
  vendor: string | null;
  notes: string | null;
  logged_by: string | null;
  generators?: { name: string };
}

interface MaintenanceLog {
  id: string;
  generator_id: string;
  service_date: string;
  service_type: string;
  hours_at_service: number | null;
  cost: number;
  currency: "BDT" | "USD";
  performed_by: string | null;
  details: string | null;
  logged_by: string | null;
  generators?: { name: string };
}

interface Profile {
  id: string;
  full_name: string;
}

const FRESH_SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.generators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model TEXT,
    capacity TEXT,
    fuel_type TEXT NOT NULL DEFAULT 'diesel',
    fuel_capacity NUMERIC NOT NULL DEFAULT 0,
    current_hours NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on generators" 
    ON public.generators FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.generator_run_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generator_id UUID NOT NULL REFERENCES public.generators(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    stopped_at TIMESTAMPTZ,
    date DATE NOT NULL,
    on_time TEXT NOT NULL,
    off_time TEXT NOT NULL,
    duration_minutes INTEGER,
    operator_name TEXT NOT NULL,
    signed_by_name TEXT,
    purpose TEXT NOT NULL DEFAULT 'outage',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generator_run_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on run logs" 
    ON public.generator_run_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.generator_refueling_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generator_id UUID NOT NULL REFERENCES public.generators(id) ON DELETE CASCADE,
    refueled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    item_type TEXT NOT NULL DEFAULT 'petrol',
    liters_added NUMERIC NOT NULL,
    cost NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BDT',
    vendor TEXT,
    notes TEXT,
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generator_refueling_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on refueling logs" 
    ON public.generator_refueling_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.generator_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generator_id UUID NOT NULL REFERENCES public.generators(id) ON DELETE CASCADE,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service_type TEXT NOT NULL,
    hours_at_service NUMERIC,
    cost NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BDT',
    performed_by TEXT,
    details TEXT,
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generator_maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on maintenance logs" 
    ON public.generator_maintenance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.generators (name, model, capacity, fuel_type, fuel_capacity, current_hours, status)
VALUES ('Main Office Generator', 'Honda Petrol Gen', '5.5 kVA', 'petrol', 15.0, 0.0, 'active')
ON CONFLICT DO NOTHING;`;

const MIGRATION_ALTER_SQL = `-- Run this in your Supabase SQL Editor if you had already run the previous schema
ALTER TABLE public.generator_run_logs 
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS on_time TEXT,
  ADD COLUMN IF NOT EXISTS off_time TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS operator_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT;

-- Make hour meter columns optional
ALTER TABLE public.generator_run_logs 
  ALTER COLUMN start_hours DROP NOT NULL;

-- Add refueling item type (Petrol vs Mobil)
ALTER TABLE public.generator_refueling_logs
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'petrol';`;

export default function GeneratorLogsPage() {
  const [generators, setGenerators] = useState<Generator[]>([]);
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [refuelLogs, setRefuelLogs] = useState<RefuelingLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [dbAlterRequired, setDbAlterRequired] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Pagination & Filtering
  const [runPage, setRunPage] = useState(1);
  const [refuelPage, setRefuelPage] = useState(1);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rangeType, setRangeType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [filterGenerator, setFilterGenerator] = useState("all");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Check if generators table exists
      const { error: checkError } = await supabaseClient.from("generators").select("id").limit(1);
      if (checkError && (checkError.code === "42P01" || checkError.message?.includes("relation") || checkError.message?.includes("does not exist"))) {
        setDbMissing(true);
        setDbAlterRequired(false);
        setLoading(false);
        return;
      }

      // 2. Fetch data (handling potential column missing errors if migrations haven't run)
      const [
        { data: gens, error: e1 },
        { data: runs, error: e2 },
        { data: refuels, error: e3 },
        { data: services, error: e4 },
        { data: profs, error: e5 }
      ] = await Promise.all([
        supabaseClient.from("generators").select("*").order("name"),
        supabaseClient.from("generator_run_logs").select("*, generators(name)").order("started_at", { ascending: false }),
        supabaseClient.from("generator_refueling_logs").select("*, generators(name)").order("refueled_at", { ascending: false }),
        supabaseClient.from("generator_maintenance_logs").select("*, generators(name)").order("service_date", { ascending: false }),
        supabaseClient
          .from("user_roles")
          .select("user_id")
          .in("role", ["staff", "project_manager", "super_admin"])
      ]);

      // Check for column missing errors (Postgrest code 42703 or message check)
      const isColumnError = (err: any) => err && (err.code === "42703" || err.message?.includes("column"));
      if (isColumnError(e2) || isColumnError(e3)) {
        setDbMissing(true);
        setDbAlterRequired(true);
        setLoading(false);
        return;
      }

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;
      if (e5) throw e5;

      // Fetch profiles for staff-only, active users
      const staffUserIds = [...new Set((profs || []).map((r: any) => r.user_id as string))];
      let dedupedProfiles: Profile[] = [];
      if (staffUserIds.length > 0) {
        // Only include employees who are active (not disabled)
        const { data: activeEmps } = await supabaseClient
          .from("employees")
          .select("profile_id")
          .in("profile_id", staffUserIds)
          .neq("status", "disabled");

        const activeProfileIds = (activeEmps || []).map((e: any) => e.profile_id as string).filter(Boolean);

        if (activeProfileIds.length > 0) {
          const { data: profileData } = await supabaseClient
            .from("profiles")
            .select("id, full_name")
            .in("id", activeProfileIds)
            .order("full_name");
          dedupedProfiles = (profileData || []) as Profile[];
        }
      }

      setGenerators(gens || []);
      setRunLogs((runs as RunLog[]) || []);
      setRefuelLogs((refuels as RefuelingLog[]) || []);
      setMaintenanceLogs((services as MaintenanceLog[]) || []);
      setProfiles(dedupedProfiles);
      setDbMissing(false);
      setDbAlterRequired(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const handleCopySql = () => {
    navigator.clipboard.writeText(dbAlterRequired ? MIGRATION_ALTER_SQL : FRESH_SETUP_SQL);
    setCopiedSql(true);
    toast.success("SQL Script copied! Execute it in Supabase SQL editor.");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // --- Metrics & Analytics calculations ---
  const stats = useMemo(() => {
    const totalRuntimeMinutes = runLogs.reduce((acc, log) => acc + (log.duration_minutes || 0), 0);
    const totalRuntimeHours = totalRuntimeMinutes / 60;

    let totalPetrolLiters = 0;
    let totalMobilLiters = 0;
    let totalCostBDT = 0;
    let totalCostUSD = 0;

    refuelLogs.forEach(log => {
      const type = (log.item_type || "petrol").toLowerCase();
      if (type.includes("mobil") || type.includes("oil")) {
        totalMobilLiters += log.liters_added;
      } else {
        totalPetrolLiters += log.liters_added;
      }

      if (log.currency === "USD") totalCostUSD += log.cost;
      else totalCostBDT += log.cost;
    });

    const lastService = maintenanceLogs.length > 0 ? maintenanceLogs[0].service_date : null;

    return {
      totalRuntimeMinutes,
      totalRuntimeHours,
      totalPetrolLiters,
      totalMobilLiters,
      totalCostBDT,
      totalCostUSD,
      lastService
    };
  }, [runLogs, refuelLogs, maintenanceLogs]);

  // Chart Data preparation
  const runChartData = useMemo(() => {
    const dataMap: Record<string, { date: string; outage: number; testing: number; maintenance: number }> = {};
    const recentLogs = [...runLogs].slice(0, 15).reverse();

    recentLogs.forEach(log => {
      const dateStr = log.date ? formatDate(log.date) : formatDate(log.started_at);
      if (!dataMap[dateStr]) {
        dataMap[dateStr] = { date: dateStr, outage: 0, testing: 0, maintenance: 0 };
      }
      const mins = Number(log.duration_minutes) || 0;
      if (log.purpose === "outage") dataMap[dateStr].outage += mins;
      else if (log.purpose === "testing") dataMap[dateStr].testing += mins;
      else if (log.purpose === "maintenance") dataMap[dateStr].maintenance += mins;
    });

    return Object.values(dataMap);
  }, [runLogs]);

  const fuelChartData = useMemo(() => {
    const dataMap: Record<string, { date: string; petrol: number; mobil: number }> = {};
    const recentRefuels = [...refuelLogs].slice(0, 15).reverse();

    recentRefuels.forEach(log => {
      const dateStr = formatDate(log.refueled_at);
      if (!dataMap[dateStr]) {
        dataMap[dateStr] = { date: dateStr, petrol: 0, mobil: 0 };
      }
      const type = (log.item_type || "petrol").toLowerCase();
      const liters = Number(log.liters_added) || 0;
      if (type.includes("mobil") || type.includes("oil")) {
        dataMap[dateStr].mobil += liters;
      } else {
        dataMap[dateStr].petrol += liters;
      }
    });

    return Object.values(dataMap);
  }, [refuelLogs]);

  const formatRuntime = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "—";
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  };

  const getProfileName = (id: string | null) => {
    return profiles.find(p => p.id === id)?.full_name || "—";
  };

  // --- Date range calculation ---
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: string, end: string;
    if (rangeType === "daily") {
      start = end = now.toISOString().split("T")[0];
    } else if (rangeType === "weekly") {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      start = startOfWeek.toISOString().split("T")[0];
      end = now.toISOString().split("T")[0];
    } else if (rangeType === "monthly") {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      end = now.toISOString().split("T")[0];
    } else {
      start = filterStartDate;
      end = filterEndDate;
    }
    return { start, end };
  }, [rangeType, filterStartDate, filterEndDate]);

  // --- Filtered & Paginated Data ---
  const filteredRunLogs = useMemo(() => {
    return runLogs.filter(log => {
      const logDate = log.date || log.started_at?.split("T")[0] || "";
      if (logDate < dateRange.start || logDate > dateRange.end) return false;
      if (filterGenerator !== "all" && log.generator_id !== filterGenerator) return false;
      return true;
    });
  }, [runLogs, dateRange, filterGenerator]);

  const filteredRefuelLogs = useMemo(() => {
    return refuelLogs.filter(log => {
      const logDate = log.refueled_at?.split("T")[0] || "";
      if (logDate < dateRange.start || logDate > dateRange.end) return false;
      if (filterGenerator !== "all" && log.generator_id !== filterGenerator) return false;
      return true;
    });
  }, [refuelLogs, dateRange, filterGenerator]);

  const filteredMaintenanceLogs = useMemo(() => {
    return maintenanceLogs.filter(log => {
      const logDate = log.service_date || "";
      if (logDate < dateRange.start || logDate > dateRange.end) return false;
      if (filterGenerator !== "all" && log.generator_id !== filterGenerator) return false;
      return true;
    });
  }, [maintenanceLogs, dateRange, filterGenerator]);

  const paginatedRunLogs = useMemo(() => {
    const start = (runPage - 1) * pageSize;
    return filteredRunLogs.slice(start, start + pageSize);
  }, [filteredRunLogs, runPage, pageSize]);

  const paginatedRefuelLogs = useMemo(() => {
    const start = (refuelPage - 1) * pageSize;
    return refuelLogs.slice(start, start + pageSize);
  }, [refuelLogs, refuelPage, pageSize]);

  const paginatedMaintenanceLogs = useMemo(() => {
    const start = (maintenancePage - 1) * pageSize;
    return maintenanceLogs.slice(start, start + pageSize);
  }, [maintenanceLogs, maintenancePage, pageSize]);

  const totalRunPages = Math.ceil(filteredRunLogs.length / pageSize);
  const totalRefuelPages = Math.ceil(refuelLogs.length / pageSize);
  const totalMaintenancePages = Math.ceil(maintenanceLogs.length / pageSize);

  // If Supabase tables/columns are not found
  if (dbMissing) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-warning/10 text-warning rounded-xl">
            <AlertCircle className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {dbAlterRequired ? "Database Update Required" : "Database Schema Required"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {dbAlterRequired
                ? "The database tables need new columns to align with your logbook layout."
                : "To use the Generator Log system, we need to create the database tables in Supabase first."}
            </p>
          </div>
        </div>

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5 shrink-0" /> Action Required
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {dbAlterRequired
                ? "We detected that the existing generator tables lack logbook fields (On Time, Off Time, duration, item type). You can update the schema instantly by running the ALTER script below."
                : "The application uses PostgreSQL tables to persistent-store generator equipment details, running times, refueling receipts, and service history. Run the setup script below to get started."}
            </p>
            <div className="text-sm">
              <span className="font-medium text-foreground">Steps to set up:</span>
              <ol className="list-decimal pl-5 mt-2 space-y-1.5 text-muted-foreground">
                <li>Copy the SQL script below.</li>
                <li>Go to your <strong>Supabase Dashboard</strong>.</li>
                <li>Open the <strong>SQL Editor</strong> from the sidebar.</li>
                <li>Paste the script and click <strong>Run</strong>.</li>
                <li>Come back here and click <strong>Refresh</strong>.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/40 py-4">
            <div>
              <CardTitle className="text-base font-semibold">
                {dbAlterRequired ? "PostgreSQL Alter Schema Script" : "PostgreSQL Fresh Setup Script"}
              </CardTitle>
              <CardDescription className="text-xs">
                {dbAlterRequired ? "Appends date, on_time, off_time, operator_name, signed_by_name and item_type columns." : "Creates all required tables for generators, runs, refuelings, and maintenance."}
              </CardDescription>
            </div>
            <Button onClick={handleCopySql} variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              {copiedSql ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Script
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed bg-black text-gray-300 rounded-b-xl max-h-[400px]">
              <code>{dbAlterRequired ? MIGRATION_ALTER_SQL : FRESH_SETUP_SQL}</code>
            </pre>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={loadData} className="gap-2 px-6 cursor-pointer">
            <Activity className="h-4 w-4" /> Refresh Status
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generator Log System</h1>
          <p className="text-muted-foreground mt-1">Track grid outage runtimes, operator signatures, and petrol/mobil purchases.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {generators.length > 0 && (
            <>
              <NewRunSheet generators={generators} profiles={profiles} onCreated={loadData} />
              <NewRefuelSheet generators={generators} profiles={profiles} onCreated={loadData} />
              <NewMaintenanceSheet generators={generators} onCreated={loadData} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : generators.length === 0 ? (
        <Card className="border-dashed border-2 py-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-muted/60 rounded-full mb-4">
            <Zap className="h-10 w-10 text-muted-foreground opacity-60" />
          </div>
          <h3 className="font-semibold text-lg">No Generators Registered</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
            Register your office or server room generator unit to start tracking runtimes and fuel purchases.
          </p>
          <NewGeneratorSheet onCreated={loadData} trigger={<Button><Plus className="h-4 w-4 mr-1.5" /> Register Generator</Button>} />
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <TabsList className="inline-flex w-auto md:grid md:w-full md:max-w-[750px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap md:grid-cols-5">
              <TabsTrigger value="overview" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Activity className="h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="runs" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Clock className="h-4 w-4" /> Run Logs</TabsTrigger>
              <TabsTrigger value="refuels" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Fuel className="h-4 w-4" /> Refueling</TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Wrench className="h-4 w-4" /> Service</TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer"><Settings className="h-4 w-4" /> Equipment</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 outline-none">
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Total Runtime</p>
                    <p className="text-3xl font-bold mt-1.5">{formatRuntime(stats.totalRuntimeMinutes)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Aggregated run duration</p>
                  </div>
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Clock className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Petrol Purchased</p>
                    <p className="text-3xl font-bold mt-1.5">{stats.totalPetrolLiters.toFixed(1)} L</p>
                    <p className="text-xs text-muted-foreground mt-1">Petrol account inventory</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Fuel className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mobil Purchased</p>
                    <p className="text-3xl font-bold mt-1.5">{stats.totalMobilLiters.toFixed(1)} L</p>
                    <p className="text-xs text-muted-foreground mt-1">Engine Lubricant oil logs</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                    <Wrench className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Total Cost</p>
                    <p className="text-2xl font-bold mt-1.5">
                      {formatCurrency(stats.totalCostBDT, "BDT")}
                      {stats.totalCostUSD > 0 && ` + ${formatCurrency(stats.totalCostUSD, "USD")}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Petrol + Mobil expenses</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Coins className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Grid Outage Runs (Minutes)</CardTitle>
                  <CardDescription>Visualizing run minutes per session</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {runChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">No runs recorded yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={runChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={11} stroke="#888888" />
                        <YAxis fontSize={11} stroke="#888888" label={{ value: "Minutes", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="outage" name="Outage Run" fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="testing" name="Testing" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="maintenance" name="Service Test" fill="#8b5cf6" radius={[4, 4, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Fuel & Mobil Accounts (Liters)</CardTitle>
                  <CardDescription>Quantities purchased per transaction date</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {fuelChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">No refueling recorded yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fuelChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" fontSize={11} stroke="#888888" />
                        <YAxis fontSize={11} stroke="#888888" label={{ value: "Liters", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="petrol" name="Petrol (Fuel)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="mobil" name="Mobil (Engine Oil)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RUN LOGS TAB */}
          <TabsContent value="runs" className="outline-none space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 border-b pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Outage Run Logs</CardTitle>
                    <CardDescription>Grid outage logs matches your handwritten register layout.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Lifetime Duration</p>
                      <p className="text-sm font-bold text-primary font-mono">{formatRuntime(runLogs.reduce((acc, l) => acc + (l.duration_minutes || 0), 0))}</p>
                    </div>
                  </div>
                </div>
                {/* Filter Bar - inline, no separate box */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Range Type</Label>
                    <Select value={rangeType} onValueChange={(v: any) => { setRangeType(v); setRunPage(1); }}>
                      <SelectTrigger className="w-full sm:w-[130px] h-9 rounded-lg cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {rangeType === "custom" && (
                    <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From</Label>
                        <div className="w-full sm:w-[160px]"><FlatDatePicker date={filterStartDate} onChange={v => { setFilterStartDate(v); setRunPage(1); }} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To</Label>
                        <div className="w-full sm:w-[160px]"><FlatDatePicker date={filterEndDate} onChange={v => { setFilterEndDate(v); setRunPage(1); }} /></div>
                      </div>
                    </div>
                  )}
                  {generators.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generator</Label>
                      <Select value={filterGenerator} onValueChange={v => { setFilterGenerator(v); setRunPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-lg cursor-pointer"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Generators</SelectItem>
                          {generators.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 md:pt-6">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Opr. Person</TableHead>
                      <TableHead>Generator</TableHead>
                      <TableHead>On Time</TableHead>
                      <TableHead>Off Time</TableHead>
                      <TableHead>Total Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRunLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">No logs found for selected range.</TableCell>
                      </TableRow>
                    ) : paginatedRunLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-semibold text-sm">{log.date ? formatDate(log.date) : formatDate(log.started_at)}</TableCell>
                        <TableCell className="text-sm font-semibold">{log.operator_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.generators?.name || "—"}</TableCell>
                        <TableCell className="font-mono text-sm font-bold">{log.on_time || "—"}</TableCell>
                        <TableCell className="font-mono text-sm font-bold">{log.off_time || "—"}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-primary">{formatRuntime(log.duration_minutes)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generator_run_logs", log.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedRunLogs.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-muted-foreground italic text-sm bg-muted/5 rounded-xl border border-dashed">No logs found for selected range.</div>
                  ) : paginatedRunLogs.map(log => (
                    <div key={log.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
                          <p className="font-semibold text-sm">{log.date ? formatDate(log.date) : formatDate(log.started_at)}</p>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 px-2 py-0.5 text-[10px] font-bold">{formatRuntime(log.duration_minutes)}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-dashed">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">On Time</p>
                          <p className="font-mono text-xs font-bold">{log.on_time || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Off Time</p>
                          <p className="font-mono text-xs font-bold">{log.off_time || "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Operator</p>
                          <p className="text-sm font-semibold">{log.operator_name || "—"}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generator_run_logs", log.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalRunPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing <strong>{(runPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(runPage * pageSize, filteredRunLogs.length)}</strong> of <strong>{filteredRunLogs.length}</strong> records
                      <span className="ml-2">Show</span>
                      <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setRunPage(1); }}>
                        <SelectTrigger className="inline-flex w-[60px] h-7 mx-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
                      </Select>
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={runPage <= 1} onClick={() => setRunPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      {Array.from({ length: Math.min(totalRunPages, 5) }, (_, i) => i + 1).map(p => (
                        <Button key={p} variant={p === runPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => setRunPage(p)}>
                          {p}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={runPage >= totalRunPages} onClick={() => setRunPage(p => p + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REFUELING LOGS TAB */}
          <TabsContent value="refuels" className="outline-none">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle className="text-base font-semibold">Fuel Accounts (Petrol / Mobil)</CardTitle>
                  <CardDescription>Log gasoline purchases and mobil/engine oil lubricant expenses.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 md:pt-6">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Refueled</TableHead>
                      <TableHead>Item Account Description</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Rate / Liter</TableHead>
                      <TableHead>Supplier/Vendor</TableHead>
                      <TableHead>Generator</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRefuelLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">No refueling found for selected range.</TableCell>
                      </TableRow>
                    ) : paginatedRefuelLogs.map(log => {
                      const rate = log.liters_added > 0 ? (log.cost / log.liters_added) : 0;
                      const isMobil = (log.item_type || "").toLowerCase().includes("mobil") || (log.item_type || "").toLowerCase().includes("oil");
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{formatDate(log.refueled_at)}</TableCell>
                          <TableCell className="font-semibold text-sm">
                            <span className={isMobil ? "text-purple-600 dark:text-purple-400" : "text-amber-600 dark:text-amber-400"}>
                              {isMobil ? "Mobil purchase" : "Petrol purchase"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">{log.liters_added} Liters</TableCell>
                          <TableCell className="font-mono text-sm font-semibold">{formatCurrency(log.cost, log.currency)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{formatCurrency(rate, log.currency)}/L</TableCell>
                          <TableCell className="text-sm">{log.vendor || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.generators?.name || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generator_refueling_logs", log.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedRefuelLogs.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-muted-foreground italic text-sm bg-muted/5 rounded-xl border border-dashed">No refueling found for selected range.</div>
                  ) : paginatedRefuelLogs.map(log => {
                    const rate = log.liters_added > 0 ? (log.cost / log.liters_added) : 0;
                    const isMobil = (log.item_type || "").toLowerCase().includes("mobil") || (log.item_type || "").toLowerCase().includes("oil");
                    return (
                      <div key={log.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
                            <p className="font-semibold text-sm">{formatDate(log.refueled_at)}</p>
                          </div>
                          <Badge className={cn("px-2 py-0.5 text-[10px] font-bold border", isMobil ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20")}>
                            {isMobil ? "Mobil" : "Petrol"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2 border-y border-dashed">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Quantity</p>
                            <p className="font-mono text-xs font-bold">{log.liters_added} Liters</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Total Cost</p>
                            <p className="font-mono text-xs font-bold">{formatCurrency(log.cost, log.currency)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Vendor</p>
                            <p className="text-sm">{log.vendor || "—"}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generator_refueling_logs", log.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalRefuelPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing <strong>{(refuelPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(refuelPage * pageSize, refuelLogs.length)}</strong> of <strong>{refuelLogs.length}</strong> records
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={refuelPage <= 1} onClick={() => setRefuelPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      {Array.from({ length: Math.min(totalRefuelPages, 5) }, (_, i) => i + 1).map(p => (
                        <Button key={p} variant={p === refuelPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => setRefuelPage(p)}>
                          {p}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={refuelPage >= totalRefuelPages} onClick={() => setRefuelPage(p => p + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SERVICE & MAINTENANCE TAB */}
          <TabsContent value="maintenance" className="outline-none">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <div>
                  <CardTitle className="text-base font-semibold">Service & Maintenance Register</CardTitle>
                  <CardDescription>Logs for spark plugs replacement, generator tune-ups, and repair details.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 md:pt-6">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Service Cost</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Generator</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMaintenanceLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">No maintenance services found for selected range.</TableCell>
                      </TableRow>
                    ) : paginatedMaintenanceLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{formatDate(log.service_date)}</TableCell>
                        <TableCell className="font-semibold text-sm capitalize">{log.service_type}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold">{formatCurrency(log.cost, log.currency)}</TableCell>
                        <TableCell className="text-sm">{log.performed_by || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.generators?.name || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generator_maintenance_logs", log.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedMaintenanceLogs.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-muted-foreground italic text-sm bg-muted/5 rounded-xl border border-dashed">No maintenance services found for selected range.</div>
                  ) : paginatedMaintenanceLogs.map(log => (
                    <div key={log.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Service Date</p>
                          <p className="font-semibold text-sm">{formatDate(log.service_date)}</p>
                        </div>
                        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 px-2 py-0.5 text-[10px] font-bold capitalize">{log.service_type}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-dashed">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Cost</p>
                          <p className="font-mono text-xs font-bold">{formatCurrency(log.cost, log.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Performed By</p>
                          <p className="text-xs font-semibold">{log.performed_by || "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Details</p>
                          <p className="text-xs text-muted-foreground truncate">{log.details || "—"}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer shrink-0" onClick={() => deleteItem("generator_maintenance_logs", log.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalMaintenancePages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing <strong>{(maintenancePage - 1) * pageSize + 1}</strong>–<strong>{Math.min(maintenancePage * pageSize, maintenanceLogs.length)}</strong> of <strong>{maintenanceLogs.length}</strong> records
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={maintenancePage <= 1} onClick={() => setMaintenancePage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      {Array.from({ length: Math.min(totalMaintenancePages, 5) }, (_, i) => i + 1).map(p => (
                        <Button key={p} variant={p === maintenancePage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => setMaintenancePage(p)}>
                          {p}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer" disabled={maintenancePage >= totalMaintenancePages} onClick={() => setMaintenancePage(p => p + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVENTORY / EQUIPMENT TAB */}
          <TabsContent value="inventory" className="outline-none">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <CardTitle className="text-base font-semibold">Generators Equipment Registry</CardTitle>
                  <CardDescription>Manage generator units, specifications, and fuel capacity parameters.</CardDescription>
                </div>
                <NewGeneratorSheet onCreated={loadData} trigger={<Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1.5" /> Add Generator</Button>} />
              </CardHeader>
              <CardContent className="p-3 md:p-6 md:pt-6">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generator Name</TableHead>
                      <TableHead>Engine Model</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Fuel Type</TableHead>
                      <TableHead>Tank Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generators.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-semibold text-sm">{g.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.model || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{g.capacity || "—"} kVA</TableCell>
                        <TableCell className="capitalize text-xs"><Badge variant="outline">{g.fuel_type}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{g.fuel_capacity} Liters</TableCell>
                        <TableCell>
                          {g.status === "active" && <Badge className="bg-green-500/10 text-green-500 border-none capitalize">Active</Badge>}
                          {g.status === "maintenance" && <Badge className="bg-yellow-500/10 text-yellow-500 border-none capitalize">Service</Badge>}
                          {g.status === "standby" && <Badge className="bg-blue-500/10 text-blue-500 border-none capitalize">Standby</Badge>}
                          {g.status === "broken" && <Badge className="bg-red-500/10 text-red-500 border-none capitalize">Broken</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generators", g.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {generators.map(g => (
                    <div key={g.id} className="bg-muted/10 rounded-xl p-4 border border-muted-foreground/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground">{g.model || "—"}</p>
                        </div>
                        <div>
                          {g.status === "active" && <Badge className="bg-green-500/10 text-green-500 border-none capitalize text-[10px]">Active</Badge>}
                          {g.status === "maintenance" && <Badge className="bg-yellow-500/10 text-yellow-500 border-none capitalize text-[10px]">Service</Badge>}
                          {g.status === "standby" && <Badge className="bg-blue-500/10 text-blue-500 border-none capitalize text-[10px]">Standby</Badge>}
                          {g.status === "broken" && <Badge className="bg-red-500/10 text-red-500 border-none capitalize text-[10px]">Broken</Badge>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 py-2 border-y border-dashed">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Capacity</p>
                          <p className="text-xs font-bold">{g.capacity || "—"} kVA</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Fuel</p>
                          <p className="text-xs font-bold capitalize">{g.fuel_type}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Tank</p>
                          <p className="text-xs font-bold">{g.fuel_capacity} L</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive cursor-pointer" onClick={() => deleteItem("generators", g.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );

  // --- Deletion Helper ---
  async function deleteItem(table: string, id: string) {
    if (!confirm("Are you sure you want to delete this log entry? This action is irreversible.")) return;
    try {
      const { error } = await supabaseClient.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Record deleted successfully");
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete record");
    }
  }
}

// ------ MODAL FORM COMPONENTS ------

function NewGeneratorSheet({ onCreated, trigger }: { onCreated: () => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    model: "",
    capacity: "",
    fuel_type: "petrol",
    fuel_capacity: "15",
    current_hours: "0",
    status: "active",
    notes: ""
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabaseClient.from("generators").insert({
        name: form.name,
        model: form.model || null,
        capacity: form.capacity || null,
        fuel_type: form.fuel_type,
        fuel_capacity: Number(form.fuel_capacity) || 0,
        current_hours: Number(form.current_hours) || 0,
        status: form.status,
        notes: form.notes || null
      });

      if (error) throw error;
      toast.success("Generator registered successfully!");
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Could not save generator specs");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Register Power Generator</SheetTitle>
          <SheetDescription>Track a new diesel, petrol or gas generator unit.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Generator Name (required)">
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Office Generator" />
          </Fld>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fld label="Brand / Engine Model">
              <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. Honda GX390" />
            </Fld>
            <Fld label="Output Capacity (kVA/kW)">
              <Input value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 5.5 kVA" />
            </Fld>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fld label="Fuel Type">
              <Select value={form.fuel_type} onValueChange={val => setForm({ ...form, fuel_type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="octane">Octane</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="gas">LPG/Natural Gas</SelectItem>
                </SelectContent>
              </Select>
            </Fld>
            <Fld label="Tank Capacity (Liters)">
              <Input type="number" required value={form.fuel_capacity} onChange={e => setForm({ ...form, fuel_capacity: e.target.value })} />
            </Fld>
          </div>

          <Fld label="Initial Status">
            <Select value={form.status} onValueChange={val => setForm({ ...form, status: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Standby)</SelectItem>
                <SelectItem value="maintenance">Under Maintenance</SelectItem>
                <SelectItem value="standby">Warm Standby</SelectItem>
                <SelectItem value="broken">Broken/Decommissioned</SelectItem>
              </SelectContent>
            </Select>
          </Fld>

          <Fld label="Location & General Notes">
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Location, dealer contacts, or service frequency." />
          </Fld>

          <SheetFooter className="pt-4">
            <Button type="submit" disabled={submitting} className="w-full cursor-pointer">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Register Generator
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function NewRunSheet({ generators, profiles, onCreated }: { generators: Generator[]; profiles: Profile[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const defaultTime24 = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const format24to12 = (tStr: string): string => {
    if (!tStr) return "";
    const parts = tStr.split(":");
    if (parts.length < 2) return tStr;
    let hrs = parseInt(parts[0]);
    const mins = parts[1];
    const ampm = hrs >= 12 ? "pm" : "am";
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    return `${String(hrs).padStart(2, "0")}:${mins} ${ampm}`;
  };

  const [form, setForm] = useState({
    generator_id: generators[0]?.id || "",
    date: toLocalDateString(),
    on_time: defaultTime24(),
    off_time: "",
    duration_minutes: "",
    operator_name: "",
    purpose: "outage",
    notes: ""
  });

  // Parse time and calculate minutes automatically
  const calculatedMins = useMemo(() => {
    if (!form.on_time || !form.off_time) return 0;

    try {
      const [hOn, mOn] = form.on_time.split(":").map(Number);
      const [hOff, mOff] = form.off_time.split(":").map(Number);
      if (isNaN(hOn) || isNaN(mOn) || isNaN(hOff) || isNaN(mOff)) return 0;

      const onMins = hOn * 60 + mOn;
      const offMins = hOff * 60 + mOff;
      let diff = offMins - onMins;
      if (diff < 0) diff += 24 * 60; // crossed midnight
      return diff;
    } catch (e) {
      console.warn("Time parsing error", e);
    }
    return 0;
  }, [form.on_time, form.off_time]);

  // Sync calculated minutes to duration field automatically if it changes
  useEffect(() => {
    if (calculatedMins > 0) {
      setForm(f => ({ ...f, duration_minutes: calculatedMins.toString() }));
    }
  }, [calculatedMins]);

  // Combined ISO timestamps for started_at & stopped_at storing in DB
  const combineDateAndTime = (dStr: string, tStr: string): string => {
    try {
      const [hrs, mins] = tStr.split(":").map(Number);
      const date = new Date(dStr);
      if (isNaN(hrs) || isNaN(mins)) return date.toISOString();

      date.setHours(hrs, mins, 0, 0);
      return date.toISOString();
    } catch (e) {
      return new Date(dStr).toISOString();
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const startIso = combineDateAndTime(form.date, form.on_time);
      const stopIso = form.off_time ? combineDateAndTime(form.date, form.off_time) : null;

      const { error } = await supabaseClient.from("generator_run_logs").insert({
        generator_id: form.generator_id,
        date: form.date,
        on_time: format24to12(form.on_time),
        off_time: form.off_time ? format24to12(form.off_time) : "",
        duration_minutes: Number(form.duration_minutes) || null,
        operator_name: form.operator_name,
        signed_by_name: null,
        started_at: startIso,
        stopped_at: stopIso,
        purpose: form.purpose,
        notes: form.notes || null
      });

      if (error) throw error;
      toast.success("Outage run log saved successfully!");
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to log run session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gradient-primary cursor-pointer"><Zap className="h-4 w-4 mr-1.5" /> Log Outage Run</Button>
      </SheetTrigger>
      <SheetContent className="p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Log Outage Run</SheetTitle>
          <SheetDescription>Log outages, operator names, and durations matching your logbook.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Fld label="Select Generator Unit">
              <Select value={form.generator_id} onValueChange={val => setForm({ ...form, generator_id: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {generators.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>

            <Fld label="Outage Date">
              <FlatDatePicker date={form.date} onChange={val => setForm({ ...form, date: val })} />
            </Fld>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fld label="On Time">
                <FlatTimePicker value={form.on_time} onChange={val => setForm({ ...form, on_time: val })} placeholder="Select on time" />
              </Fld>
              <Fld label="Off Time">
                <FlatTimePicker value={form.off_time} onChange={val => setForm({ ...form, off_time: val })} placeholder="Select off time" />
              </Fld>
            </div>

            <div className="grid">
              <Fld label="Total Duration (Minutes)">
                <Input type="number" required placeholder="Calculated minutes" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
              </Fld>
              <div className="flex flex-col justify-end pb-1.5 pl-1">
                {Number(form.duration_minutes) > 0 && (
                  <div className="text-xs bg-muted p-2 rounded-lg text-muted-foreground flex items-center gap-1 font-medium">
                    <Clock className="h-3 w-3 text-blue-600" />
                    Preview: {Math.floor(Number(form.duration_minutes) / 60)}h {Number(form.duration_minutes) % 60}m
                  </div>
                )}
              </div>
            </div>

            <Fld label="Operator (Opr. Person)">
              <Select value={form.operator_name} onValueChange={val => setForm({ ...form, operator_name: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operator staff" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.full_name}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Fld>

            <Fld label="Outage Purpose">
              <Select value={form.purpose} onValueChange={val => setForm({ ...form, purpose: val as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outage">Grid Outage (Load Shedding)</SelectItem>
                  <SelectItem value="testing">Periodic Testing</SelectItem>
                  <SelectItem value="maintenance">Maintenance Service</SelectItem>
                </SelectContent>
              </Select>
            </Fld>

            <Fld label="Notes">
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Add comments here." />
            </Fld>
          </div>

          <div className="p-6 border-t bg-muted/20">
            <Button type="submit" disabled={submitting} className="w-full cursor-pointer">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Save Run Log"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function NewRefuelSheet({ generators, profiles, onCreated }: { generators: Generator[]; profiles: Profile[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const defaultTime24 = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    generator_id: generators[0]?.id || "",
    purchase_date: toLocalDateString(),
    purchase_time: defaultTime24(),
    item_type: "petrol",
    liters_added: "",
    unit_price: "",
    cost: "",
    currency: "BDT",
    vendor: "",
    notes: "",
    logged_by: ""
  });

  const ratePreview = useMemo(() => {
    const price = Number(form.unit_price);
    if (!price || price <= 0) return null;
    return `Rate: ${formatCurrency(price, "BDT")}/L`;
  }, [form.unit_price]);

  // Auto calculate cost when liters_added or unit_price changes
  useEffect(() => {
    const qty = Number(form.liters_added) || 0;
    const price = Number(form.unit_price) || 0;
    if (qty > 0 && price > 0) {
      setForm(f => ({ ...f, cost: (qty * price).toFixed(2) }));
    }
  }, [form.liters_added, form.unit_price]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const purchaseDateTime = () => {
        try {
          const dt = new Date(`${form.purchase_date}T${form.purchase_time}`);
          return dt.toISOString();
        } catch (err) {
          return new Date().toISOString();
        }
      };

      const { error } = await supabaseClient.from("generator_refueling_logs").insert({
        generator_id: form.generator_id,
        refueled_at: purchaseDateTime(),
        item_type: form.item_type,
        liters_added: Number(form.liters_added) || 0,
        cost: Number(form.cost) || 0,
        currency: "BDT",
        vendor: form.vendor || null,
        notes: form.notes || null,
        logged_by: form.logged_by || null
      });

      if (error) throw error;
      toast.success("Refueling logged successfully!");
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to log refueling invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/30 dark:hover:bg-emerald-400/10 cursor-pointer">
          <Fuel className="h-4 w-4 mr-1.5" /> Log Refueling
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Log Generator Refueling</SheetTitle>
          <SheetDescription>Log fuel purchases (diesel, octane) and mobil lubricant accounts.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Fld label="Select Generator Unit">
              <Select value={form.generator_id} onValueChange={val => setForm({ ...form, generator_id: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {generators.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>

            <Fld label="Fuel Account Item">
              <Select value={form.item_type} onValueChange={val => setForm({ ...form, item_type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol purchase</SelectItem>
                  <SelectItem value="mobil">Mobil (Engine Oil) purchase</SelectItem>
                  <SelectItem value="octane">Octane purchase</SelectItem>
                  <SelectItem value="diesel">Diesel purchase</SelectItem>
                </SelectContent>
              </Select>
            </Fld>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fld label="Date Purchased">
                <FlatDatePicker date={form.purchase_date} onChange={val => setForm({ ...form, purchase_date: val })} />
              </Fld>
              <Fld label="Time Purchased">
                <FlatTimePicker value={form.purchase_time} onChange={val => setForm({ ...form, purchase_time: val })} placeholder="Select time" />
              </Fld>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fld label="Quantity (Liters)">
                <Input type="number" step="0.01" required placeholder="e.g. 5" value={form.liters_added} onChange={e => setForm({ ...form, liters_added: e.target.value })} />
              </Fld>
              <Fld label="Unit Price (Per Liter)">
                <Input type="number" step="0.01" placeholder="e.g. 125" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} />
              </Fld>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fld label="Total Price / Cost">
                <Input type="number" required placeholder="Calculated automatically" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
              </Fld>
              <Fld label="Brand / Vendor / Station">
                <Input placeholder="e.g. Trust Station" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
              </Fld>
            </div>

            <Fld label="Purchased By">
              <Select value={form.logged_by} onValueChange={val => setForm({ ...form, logged_by: val })}>
                <SelectTrigger><SelectValue placeholder="Select Staff" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>

            {ratePreview && (
              <div className="text-xs bg-muted p-2 rounded-lg text-emerald-600 flex items-center gap-1 font-mono font-medium max-w-max">
                <Coins className="h-3 w-3" />
                {ratePreview}
              </div>
            )}

            <Fld label="Notes">
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Bill receipt references, notes, etc." />
            </Fld>
          </div>

          <div className="p-6 border-t bg-muted/20">
            <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Save Fuel Entry"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function NewMaintenanceSheet({ generators, onCreated }: { generators: Generator[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    generator_id: generators[0]?.id || "",
    service_date: new Date().toISOString().split('T')[0],
    service_type: "Engine Tune-up",
    cost: "0",
    currency: "BDT",
    performed_by: "",
    details: ""
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabaseClient.from("generator_maintenance_logs").insert({
        generator_id: form.generator_id,
        service_date: form.service_date,
        service_type: form.service_type,
        cost: Number(form.cost) || 0,
        currency: "BDT",
        performed_by: form.performed_by || null,
        details: form.details || null
      });

      if (error) throw error;

      // Update generator's status to active
      await supabaseClient.from("generators").update({ status: "active" }).eq("id", form.generator_id);

      toast.success("Maintenance log added successfully!");
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save maintenance service log");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 dark:text-purple-400 dark:border-purple-400/30 dark:hover:bg-purple-400/10 cursor-pointer">
          <Wrench className="h-4 w-4 mr-1.5" /> Log Service
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Log Generator Maintenance</SheetTitle>
          <SheetDescription>Log spark plugs replacement, generator tune-ups, filter cleans, or mechanical servicing.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Fld label="Select Generator Unit">
              <Select value={form.generator_id} onValueChange={val => setForm({ ...form, generator_id: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {generators.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fld label="Date of Service">
                <FlatDatePicker date={form.service_date} onChange={val => setForm({ ...form, service_date: val })} />
              </Fld>
              <Fld label="Service Type">
                <Select value={form.service_type} onValueChange={val => setForm({ ...form, service_type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engine Tune-up">Engine Tune-up</SelectItem>
                    <SelectItem value="Spark Plug Replacement">Spark Plug Replacement</SelectItem>
                    <SelectItem value="Oil Change">Oil Change</SelectItem>
                    <SelectItem value="Clean Carburetor">Clean Carburetor</SelectItem>
                    <SelectItem value="Filter Clean/Replacement">Filter Cleaning</SelectItem>
                    <SelectItem value="Other Repairs">Other Repairs</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
            </div>

            <Fld label="Service Technician / Workshop">
              <Input placeholder="e.g. Local Mechanic, Honda Service Center" value={form.performed_by} onChange={e => setForm({ ...form, performed_by: e.target.value })} />
            </Fld>

            <Fld label="Service / Repair Cost (BDT)">
              <Input type="number" placeholder="e.g. 1500" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            </Fld>

            <Fld label="Details">
              <Textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={3} placeholder="Describe the service details or parts replaced." />
            </Fld>
          </div>

          <div className="p-6 border-t bg-muted/20">
            <Button type="submit" disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 cursor-pointer">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Save Service Log"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
