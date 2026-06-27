"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../../../components/ui/sheet";
import { Switch } from "../../../components/ui/switch";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Globe, Calendar, AlertTriangle, AlertCircle, ShieldCheck, Edit, Trash2, Plus, ExternalLink, Loader2, RefreshCw, Search, Folder, DollarSign, Bell } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../../../lib/format";
import { CardGridSkeleton } from "../../../components/loading-skeletons";

interface ClientFolder {
  id: string;
  company_name: string;
}

interface DomainTrackerItem {
  id: string;
  domain_name: string;
  client_id: string | null;
  folder_name: string;
  registrar: string;
  renewal_date: string;
  reminder_days: number;
  auto_renew: boolean;
  price: number | null;
  notes: string;
  created_by_name: string;
  created_at: string;
}

export default function DomainsPage() {
  const { profile, roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

  const [domains, setDomains] = useState<DomainTrackerItem[]>([]);
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<"all" | string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "active" | "expiring" | "expired">("all");

  // Form sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainTrackerItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form fields
  const [domainName, setDomainName] = useState("");
  const [clientId, setClientId] = useState<string>("personal");
  const [registrar, setRegistrar] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [reminderDays, setReminderDays] = useState("30");
  const [autoRenew, setAutoRenew] = useState(false);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void loadDomains();
    void loadFolders();
  }, []);

  async function fetchWithAuth(urlStr: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(urlStr, { ...options, headers });
  }

  async function loadDomains() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/domains");
      if (!res.ok) throw new Error("Failed to load domains data");
      const data = await res.json();
      setDomains(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load domain items");
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

  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewal = new Date(dateStr);
    renewal.setHours(0, 0, 0, 0);
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatus = (renewalDateStr: string, remDays: number) => {
    const days = getDaysRemaining(renewalDateStr);
    if (days <= 0) return "expired";
    if (days <= remDays) return "expiring";
    return "active";
  };

  // KPI Calculations
  const stats = useMemo(() => {
    let total = domains.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let autoRenewCount = 0;

    domains.forEach(d => {
      const s = getStatus(d.renewal_date, d.reminder_days);
      if (s === "active") active++;
      else if (s === "expiring") expiring++;
      else if (s === "expired") expired++;
      
      if (d.auto_renew) autoRenewCount++;
    });

    return { total, active, expiring, expired, autoRenewCount };
  }, [domains]);

  // Filters mapping
  const filteredDomains = useMemo(() => {
    return domains.filter(d => {
      const matchesQ =
        !q ||
        d.domain_name.toLowerCase().includes(q.toLowerCase()) ||
        d.registrar.toLowerCase().includes(q.toLowerCase());

      const matchesFolder =
        selectedFolderFilter === "all" ||
        (selectedFolderFilter === "personal" && !d.client_id) ||
        d.client_id === selectedFolderFilter;

      const status = getStatus(d.renewal_date, d.reminder_days);
      const matchesStatus =
        selectedStatusFilter === "all" ||
        status === selectedStatusFilter;

      return matchesQ && matchesFolder && matchesStatus;
    });
  }, [domains, q, selectedFolderFilter, selectedStatusFilter]);

  const openAddSheet = () => {
    setEditingDomain(null);
    setDomainName("");
    setClientId("personal");
    setRegistrar("");
    setRenewalDate("");
    setReminderDays("30");
    setAutoRenew(false);
    setPrice("");
    setNotes("");
    setFormOpen(true);
  };

  const openEditSheet = (d: DomainTrackerItem) => {
    setEditingDomain(d);
    setDomainName(d.domain_name);
    setClientId(d.client_id || "personal");
    setRegistrar(d.registrar);
    setRenewalDate(d.renewal_date);
    setReminderDays(d.reminder_days.toString());
    setAutoRenew(d.auto_renew);
    setPrice(d.price !== null ? d.price.toString() : "");
    setNotes(d.notes);
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainName.trim()) return toast.error("Domain name is required");
    if (!renewalDate) return toast.error("Renewal date is required");

    setFormSubmitting(true);

    const payload = {
      id: editingDomain?.id,
      domain_name: domainName.trim().toLowerCase(),
      client_id: clientId === "personal" ? null : clientId,
      registrar: registrar.trim(),
      renewal_date: renewalDate,
      reminder_days: parseInt(reminderDays, 10),
      auto_renew: autoRenew,
      price: price ? parseFloat(price) : null,
      notes: notes.trim()
    };

    try {
      const method = editingDomain ? "PUT" : "POST";
      const res = await fetchWithAuth("/api/domains", {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save domain details");
      }

      toast.success(editingDomain ? "Domain updated successfully" : "Domain added successfully");
      setFormOpen(false);
      void loadDomains();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleQuickRenew = async (d: DomainTrackerItem) => {
    const currentDate = new Date(d.renewal_date);
    currentDate.setFullYear(currentDate.getFullYear() + 1);
    const newRenewalDate = currentDate.toISOString().split("T")[0];

    if (!confirm(`Are you sure you want to mark domain "${d.domain_name}" as renewed? This will extend its renewal date by 1 year to ${newRenewalDate}.`)) return;

    try {
      const payload = {
        id: d.id,
        domain_name: d.domain_name,
        client_id: d.client_id,
        registrar: d.registrar,
        renewal_date: newRenewalDate,
        reminder_days: d.reminder_days,
        auto_renew: d.auto_renew,
        price: d.price,
        notes: d.notes
      };

      const res = await fetchWithAuth("/api/domains", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update domain");
      }

      toast.success(`Domain "${d.domain_name}" renewed successfully! New date: ${newRenewalDate}`);
      void loadDomains();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from tracker?`)) return;
    try {
      const res = await fetchWithAuth(`/api/domains?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete domain record");
      toast.success("Domain removed from tracker successfully");
      void loadDomains();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain Tracker</h1>
          <p className="text-muted-foreground mt-1">Manage and track client domain renewals and registrations.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={loadDomains}
            className="cursor-pointer shrink-0"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={openAddSheet}
            className="flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Domain
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card/45 border-border/50">
              <CardContent className="p-6 space-y-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/45 backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Domains</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Globe className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/45 backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active & Safe</p>
                <p className="text-3xl font-bold text-emerald-500">{stats.active}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/45 backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring Soon</p>
                <p className="text-3xl font-bold text-amber-500">{stats.expiring}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/45 backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expired</p>
                <p className="text-3xl font-bold text-rose-500">{stats.expired}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/45 backdrop-blur-sm border border-border/40 p-4 rounded-2xl">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search domain or registrar..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Client Folder Filter */}
          <Select value={selectedFolderFilter} onValueChange={setSelectedFolderFilter}>
            <SelectTrigger className="w-[180px] cursor-pointer">
              <SelectValue placeholder="Folder / Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">All Folders</SelectItem>
              <SelectItem value="personal" className="cursor-pointer">Personal / Internal</SelectItem>
              {folders.map(f => (
                <SelectItem key={f.id} value={f.id} className="cursor-pointer">
                  {f.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatusFilter} onValueChange={v => setSelectedStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px] cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">All Status</SelectItem>
              <SelectItem value="active" className="cursor-pointer">Active / Safe</SelectItem>
              <SelectItem value="expiring" className="cursor-pointer">Expiring Soon</SelectItem>
              <SelectItem value="expired" className="cursor-pointer">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : filteredDomains.length === 0 ? (
        <Card className="border-dashed bg-card/30 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <Globe className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="font-semibold text-lg text-foreground">No Domains Found</p>
            <p className="text-sm mt-1 max-w-sm">
              {q || selectedFolderFilter !== "all" || selectedStatusFilter !== "all"
                ? "No client domains match your current filter parameters."
                : "Get started by adding domain tracking data for your clients."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDomains.map(d => {
            const daysLeft = getDaysRemaining(d.renewal_date);
            const status = getStatus(d.renewal_date, d.reminder_days);

            // Badge Color Settings
            let statusBadge = (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] py-0.5 font-medium">
                <ShieldCheck className="h-3 w-3 mr-1" /> Active
              </Badge>
            );
            let borderStyle = "border-border/50";
            if (status === "expired") {
              statusBadge = (
                <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[11px] py-0.5 font-medium">
                  <AlertCircle className="h-3 w-3 mr-1" /> Expired
                </Badge>
              );
              borderStyle = "border-rose-500/30 shadow-sm shadow-rose-500/5";
            } else if (status === "expiring") {
              statusBadge = (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[11px] py-0.5 font-medium">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Expiring Soon
                </Badge>
              );
              borderStyle = "border-amber-500/30 shadow-sm shadow-amber-500/5";
            }

            return (
              <Card key={d.id} className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-card/65 border ${borderStyle}`}>
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center overflow-hidden border border-border shrink-0">
                      <Globe className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold tracking-tight truncate max-w-[160px]">{d.domain_name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        <a
                          href={`http://${d.domain_name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1 text-primary inline-flex cursor-pointer text-[11px]"
                        >
                          Visit Domain <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </CardDescription>
                    </div>
                  </div>
                  {statusBadge}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Renewal Details card block */}
                  <div className="space-y-2.5 bg-muted/30 rounded-xl p-3.5 border border-border/40 text-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Renewal Date</span>
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {formatDate(d.renewal_date)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2.5">
                      <span className="text-muted-foreground font-medium">Days Remaining</span>
                      <span className={`font-semibold ${daysLeft <= 0 ? "text-rose-500" : daysLeft <= d.reminder_days ? "text-amber-500" : "text-emerald-500"}`}>
                        {daysLeft <= 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2.5">
                      <span className="text-muted-foreground font-medium">Registrar</span>
                      <span className="font-mono text-foreground font-medium">{d.registrar}</span>
                    </div>

                    {d.price !== null && (
                      <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2.5">
                        <span className="text-muted-foreground font-medium">Cost / Cost Basis</span>
                        <span className="font-semibold text-foreground flex items-center">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />{d.price} / year
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata labels */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Folder className="h-3.5 w-3.5" />
                      <Badge variant="secondary" className="px-1.5 py-0 font-normal">
                        {d.folder_name}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
                      {d.auto_renew ? (
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 py-0 text-[10px]">Auto-Renew ON</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 py-0 text-[10px]">Auto-Renew OFF</Badge>
                      )}
                    </div>
                  </div>

                  {d.notes && (
                    <div className="text-[11px] text-muted-foreground bg-accent/20 border border-border/20 p-2.5 rounded-lg italic line-clamp-2">
                      {d.notes}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-border/40">
                    {(status === "expired" || status === "expiring") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer mr-auto"
                        onClick={() => handleQuickRenew(d)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Mark Renewed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => openEditSheet(d)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => handleDelete(d.id, d.domain_name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Sheet Drawer */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex flex-col h-full p-0 max-w-[500px] sm:max-w-[540px]">
          <div className="py-3 px-6 border-b border-border/40 shrink-0">
            <SheetHeader>
              <SheetTitle>{editingDomain ? "Edit Domain Tracker" : "Add Domain Tracker"}</SheetTitle>
              <SheetDescription>
                Track registration details, renewal date, and auto-renew config for client domains.
              </SheetDescription>
            </SheetHeader>
          </div>

          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="domainName" className="text-xs">Domain Name *</Label>
                <Input
                  id="domainName"
                  value={domainName}
                  onChange={e => setDomainName(e.target.value)}
                  placeholder="e.g. codenextit.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="registrar" className="text-xs">Registrar</Label>
                  <Input
                    id="registrar"
                    value={registrar}
                    onChange={e => setRegistrar(e.target.value)}
                    placeholder="e.g. Namecheap, Cloudflare"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="folder" className="text-xs">Select Folder / Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id="folder" className="cursor-pointer">
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal" className="cursor-pointer">Personal / Internal</SelectItem>
                      {folders.map(f => (
                        <SelectItem key={f.id} value={f.id} className="cursor-pointer">
                          {f.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="renewalDate" className="text-xs">Renewal Date *</Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={renewalDate}
                    onChange={e => setRenewalDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-xs">Cost basis / Price (USD / year)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. 12.99"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center border-t border-border pt-4 pb-1">
                <div className="space-y-1.5">
                  <Label htmlFor="reminderDays" className="text-xs flex items-center gap-1">
                    <Bell className="h-3.5 w-3.5 text-primary" /> Renewal Reminder
                  </Label>
                  <Select value={reminderDays} onValueChange={setReminderDays}>
                    <SelectTrigger id="reminderDays" className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7" className="cursor-pointer">7 Days Before</SelectItem>
                      <SelectItem value="14" className="cursor-pointer">14 Days Before</SelectItem>
                      <SelectItem value="30" className="cursor-pointer">30 Days Before</SelectItem>
                      <SelectItem value="60" className="cursor-pointer">60 Days Before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between border border-border/60 bg-muted/20 p-3.5 rounded-xl mt-3.5">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoRenew" className="text-xs cursor-pointer font-semibold">Auto-Renew</Label>
                    <p className="text-[10px] text-muted-foreground">Auto-renew active at registrar</p>
                  </div>
                  <Switch
                    id="autoRenew"
                    checked={autoRenew}
                    onCheckedChange={setAutoRenew}
                  />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border pt-4">
                <Label htmlFor="notes" className="text-xs">Notes / Registrant Info (Optional)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Registry credentials detail, registrant email, custom DNS info, etc."
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
              <SheetFooter className="mt-0">
                <Button type="submit" disabled={formSubmitting} className="w-full cursor-pointer">
                  {formSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    editingDomain ? "Save Changes" : "Track Domain"
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
