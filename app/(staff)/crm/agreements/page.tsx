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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
import { FileText, Plus, Edit, Trash2, Calendar, DollarSign, Percent, Loader2, Search, Info, CheckCircle2, User, Briefcase, Trash } from "lucide-react";
import { formatCurrency, formatDate } from "../../../../lib/format";
import { toast } from "sonner";
import { Skeleton } from "../../../../components/ui/skeleton";

interface Client {
  id: string;
  company_name: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string | null;
}

interface CustomInstallment {
  label: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid";
}

interface Agreement {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  status: "draft" | "active" | "completed" | "terminated";
  setup_fee: number;
  advance_percentage: number;
  maintenance_fee: number;
  maintenance_billing_day: number;
  custom_installments: CustomInstallment[];
  start_date: string;
  end_date: string | null;
  created_at: string;
  clients?: {
    company_name: string;
  } | null;
  projects?: {
    name: string;
  } | null;
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedClientFilter, setSelectedClientFilter] = useState<"all" | string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | string>("all");

  // Details dialog state
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Form sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch Agreements with joined Client & Project names
      const { data: agData, error: agErr } = await supabase
        .from("agreements" as any)
        .select(`
          *,
          clients:client_id ( company_name ),
          projects:project_id ( name )
        `)
        .order("created_at", { ascending: false });

      if (agErr) throw agErr;
      setAgreements((agData || []) as any[]);

      // 2. Fetch Clients
      const { data: clData, error: clErr } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("is_vault_folder", false)
        .order("company_name", { ascending: true });

      if (clErr) throw clErr;
      setClients(clData || []);

      // 3. Fetch Projects
      const { data: prData, error: prErr } = await supabase
        .from("projects")
        .select("id, name, client_id")
        .order("name", { ascending: true });

      if (prErr) throw prErr;
      setProjects(prData || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load agreements data");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAgreement(id: string) {
    if (!confirm("Are you sure you want to delete this agreement?")) return;
    try {
      const { error } = await supabase.from("agreements" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Agreement deleted successfully");
      setIsDetailsOpen(false);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agreement");
    }
  }

  // Filter logic
  const filteredAgreements = useMemo(() => {
    return agreements.filter((ag) => {
      const matchesQ =
        !q ||
        ag.title.toLowerCase().includes(q.toLowerCase()) ||
        (ag.clients?.company_name || "").toLowerCase().includes(q.toLowerCase());

      const matchesClient =
        selectedClientFilter === "all" || ag.client_id === selectedClientFilter;

      const matchesStatus =
        selectedStatusFilter === "all" || ag.status === selectedStatusFilter;

      return matchesQ && matchesClient && matchesStatus;
    });
  }, [agreements, q, selectedClientFilter, selectedStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Agreements</h1>
          <p className="text-muted-foreground mt-1">
            Manage agency-client service contracts, setup fees, maintenance fees, and split installments.
          </p>
        </div>
        <Button onClick={() => { setEditingAgreement(null); setIsSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Agreement
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/45 backdrop-blur-sm border border-border/40 p-4 rounded-2xl">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agreement or client..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid List View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card/45 border-border/50 p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-2 pt-4 border-t">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredAgreements.length === 0 ? (
        <Card className="border-dashed bg-card/30 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-3 text-muted-foreground/60" />
            <p className="font-semibold text-lg text-foreground">No Agreements Found</p>
            <p className="text-sm mt-1 max-w-sm">
              Create an agreement to establish a structured payment flow for a client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgreements.map((ag) => {
            let badgeStyle = "bg-slate-500/10 text-slate-500 border-slate-500/20";
            if (ag.status === "active") badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            else if (ag.status === "completed") badgeStyle = "bg-blue-500/10 text-blue-500 border-blue-500/20";
            else if (ag.status === "terminated") badgeStyle = "bg-rose-500/10 text-rose-500 border-rose-500/20";

            return (
              <Card
                key={ag.id}
                onClick={() => { setSelectedAgreement(ag); setIsDetailsOpen(true); }}
                className="group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-card/65 border border-border/50"
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1 truncate pr-2">
                    <CardTitle className="text-base font-semibold tracking-tight truncate group-hover:text-primary transition-colors">
                      {ag.title}
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1">
                      <User className="h-3 w-3" /> {ag.clients?.company_name || "Unknown Client"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={`shrink-0 capitalize ${badgeStyle}`}>
                    {ag.status}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Financial Quick Metrics */}
                  <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-xl p-3 border border-border/40 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium uppercase text-[10px]">Setup Fee</p>
                      <p className="font-semibold text-foreground mt-0.5">{formatCurrency(ag.setup_fee, "BDT")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium uppercase text-[10px]">Maintenance Fee</p>
                      <p className="font-semibold text-foreground mt-0.5">{formatCurrency(ag.maintenance_fee, "BDT")}/mo</p>
                    </div>
                    <div className="border-t border-border/40 pt-2 col-span-2 flex justify-between items-center mt-1">
                      <span className="text-muted-foreground font-medium">Advance Percentage</span>
                      <span className="font-semibold text-foreground">{ag.advance_percentage}%</span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Start: {formatDate(ag.start_date)}
                    </span>
                    {ag.end_date && <span>End: {formatDate(ag.end_date)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[550px]">
          {selectedAgreement && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-xl">{selectedAgreement.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-1 mt-1 text-sm">
                      <User className="h-4 w-4" /> Client: {selectedAgreement.clients?.company_name}
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {selectedAgreement.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4 text-sm">
                {selectedAgreement.projects && (
                  <div className="flex items-center gap-2 bg-accent/25 border p-2.5 rounded-lg text-xs">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Linked Project:</span> {selectedAgreement.projects.name}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 border-r pr-2">
                    <span className="text-xs uppercase text-muted-foreground">Setup Fee</span>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(selectedAgreement.setup_fee, "BDT")}</p>
                  </div>
                  <div className="space-y-1 pl-2">
                    <span className="text-xs uppercase text-muted-foreground">Advance Payment</span>
                    <p className="text-lg font-bold text-foreground">
                      {selectedAgreement.advance_percentage}% ({formatCurrency((selectedAgreement.setup_fee * selectedAgreement.advance_percentage) / 100, "BDT")})
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-3">
                  <div className="space-y-1 border-r pr-2">
                    <span className="text-xs uppercase text-muted-foreground">Maintenance Fee</span>
                    <p className="text-base font-semibold text-primary">{formatCurrency(selectedAgreement.maintenance_fee, "BDT")} / month</p>
                  </div>
                  <div className="space-y-1 pl-2">
                    <span className="text-xs uppercase text-muted-foreground">Billing Day</span>
                    <p className="text-base font-semibold text-foreground">Day {selectedAgreement.maintenance_billing_day} of every month</p>
                  </div>
                </div>

                {/* Custom Installments */}
                <div className="border-t pt-3 space-y-2">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground">Custom Payment Installments</h4>
                  {selectedAgreement.custom_installments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No custom installments configured.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {selectedAgreement.custom_installments.map((inst, index) => (
                        <div key={index} className="flex justify-between items-center text-xs bg-muted/40 p-2.5 rounded-lg border">
                          <div>
                            <span className="font-semibold text-foreground">{inst.label}</span>
                            <span className="text-muted-foreground text-[10px] block mt-0.5">Due: {formatDate(inst.due_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatCurrency(inst.amount, "BDT")}</span>
                            <Badge variant={inst.status === "paid" ? "default" : "outline"} className="text-[10px] px-1.5 py-0.5 shrink-0">
                              {inst.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-3 text-xs text-muted-foreground">
                  <div>
                    <span>Contract Signed:</span> <strong className="text-foreground">{formatDate(selectedAgreement.start_date)}</strong>
                  </div>
                  {selectedAgreement.end_date && (
                    <div>
                      <span>Contract Expiry:</span> <strong className="text-foreground">{formatDate(selectedAgreement.end_date)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 justify-end sm:justify-end border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setEditingAgreement(selectedAgreement);
                    setIsSheetOpen(true);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteAgreement(selectedAgreement.id)}
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create & Edit Agreement Sheet Drawer */}
      <AgreementSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSaved={loadData}
        editingAgreement={editingAgreement}
        clients={clients}
        projects={projects}
      />
    </div>
  );
}

interface AgreementSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editingAgreement: Agreement | null;
  clients: Client[];
  projects: Project[];
}

function AgreementSheet({
  open,
  onOpenChange,
  onSaved,
  editingAgreement,
  clients,
  projects
}: AgreementSheetProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "completed" | "terminated">("draft");
  const [setupFee, setSetupFee] = useState("0");
  const [advancePercentage, setAdvancePercentage] = useState("0");
  const [maintenanceFee, setMaintenanceFee] = useState("0");
  const [maintenanceBillingDay, setMaintenanceBillingDay] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Custom installments list state
  const [installments, setInstallments] = useState<CustomInstallment[]>([]);
  
  // Single installment form add states
  const [instLabel, setInstLabel] = useState("");
  const [instAmount, setInstAmount] = useState("");
  const [instDueDate, setInstDueDate] = useState("");

  // Filter projects based on selected client
  const clientProjects = useMemo(() => {
    if (!clientId) return [];
    return projects.filter((p) => p.client_id === clientId);
  }, [clientId, projects]);

  useEffect(() => {
    if (editingAgreement) {
      setClientId(editingAgreement.client_id);
      setProjectId(editingAgreement.project_id || "none");
      setTitle(editingAgreement.title);
      setStatus(editingAgreement.status);
      setSetupFee(editingAgreement.setup_fee.toString());
      setAdvancePercentage(editingAgreement.advance_percentage.toString());
      setMaintenanceFee(editingAgreement.maintenance_fee.toString());
      setMaintenanceBillingDay(editingAgreement.maintenance_billing_day.toString());
      setStartDate(editingAgreement.start_date);
      setEndDate(editingAgreement.end_date || "");
      setInstallments(editingAgreement.custom_installments || []);
    } else {
      setClientId("");
      setProjectId("none");
      setTitle("");
      setStatus("draft");
      setSetupFee("0");
      setAdvancePercentage("0");
      setMaintenanceFee("0");
      setMaintenanceBillingDay("1");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setInstallments([]);
    }
    setInstLabel("");
    setInstAmount("");
    setInstDueDate("");
  }, [editingAgreement, open]);

  // Installment addition handler
  function addInstallment() {
    if (!instLabel.trim()) return toast.error("Installment label is required");
    if (!instAmount || parseFloat(instAmount) <= 0) return toast.error("Amount must be greater than 0");
    if (!instDueDate) return toast.error("Due date is required");

    const newInst: CustomInstallment = {
      label: instLabel.trim(),
      amount: parseFloat(instAmount),
      due_date: instDueDate,
      status: "pending"
    };

    setInstallments([...installments, newInst]);
    setInstLabel("");
    setInstAmount("");
    setInstDueDate("");
    toast.success("Installment added");
  }

  // Installment deletion handler
  function removeInstallment(index: number) {
    setInstallments(installments.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return toast.error("Please select a client");
    if (!title.trim()) return toast.error("Please enter a title");

    setSubmitting(true);

    const payload = {
      client_id: clientId,
      project_id: projectId === "none" ? null : projectId,
      title: title.trim(),
      status,
      setup_fee: parseFloat(setupFee) || 0,
      advance_percentage: parseFloat(advancePercentage) || 0,
      maintenance_fee: parseFloat(maintenanceFee) || 0,
      maintenance_billing_day: parseInt(maintenanceBillingDay, 10) || 1,
      custom_installments: installments,
      start_date: startDate,
      end_date: endDate || null
    };

    try {
      const { error } = editingAgreement
        ? await supabase.from("agreements" as any).update(payload).eq("id", editingAgreement.id)
        : await supabase.from("agreements" as any).insert(payload);

      if (error) throw error;

      toast.success(editingAgreement ? "Agreement updated successfully" : "Agreement created successfully");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save agreement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl flex flex-col h-full p-0">
        <div className="py-3 px-6 border-b shrink-0">
          <SheetHeader>
            <SheetTitle>{editingAgreement ? "Edit Agreement" : "New Agreement"}</SheetTitle>
            <SheetDescription>
              Define the billing terms, setup fees, maintenance fees, and split installments.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* General Fields */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">Agreement Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Website Development and Maintenance Agreement"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="client" className="text-xs font-semibold">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project" className="text-xs font-semibold">Project (Optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="No project link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project link</SelectItem>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-semibold">Agreement Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs font-semibold">Contract Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Financial Terms */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-primary">
                <DollarSign className="h-4 w-4" /> Financial Setup & Terms
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setupFee" className="text-xs font-semibold">Setup Fee (BDT)</Label>
                  <Input
                    id="setupFee"
                    type="number"
                    value={setupFee}
                    onChange={(e) => setSetupFee(e.target.value)}
                    placeholder="25000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="advancePercentage" className="text-xs font-semibold flex items-center gap-0.5">
                    Advance (%) <Percent className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input
                    id="advancePercentage"
                    type="number"
                    value={advancePercentage}
                    onChange={(e) => setAdvancePercentage(e.target.value)}
                    placeholder="40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold">Expiry Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maintenanceFee" className="text-xs font-semibold">Maintenance Fee (BDT / mo)</Label>
                  <Input
                    id="maintenanceFee"
                    type="number"
                    value={maintenanceFee}
                    onChange={(e) => setMaintenanceFee(e.target.value)}
                    placeholder="4000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="billingDay" className="text-xs font-semibold">Billing Day of Month (1-31)</Label>
                  <Input
                    id="billingDay"
                    type="number"
                    min="1"
                    max="31"
                    value={maintenanceBillingDay}
                    onChange={(e) => setMaintenanceBillingDay(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            {/* Custom Installments Section */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-primary">
                <Calendar className="h-4 w-4" /> Custom Split Installments
              </h4>

              {/* Installment creation fields */}
              <div className="grid grid-cols-3 gap-2 bg-muted/30 border p-3 rounded-xl">
                <div className="space-y-1">
                  <Label className="text-[10px]">Installment Label</Label>
                  <Input
                    value={instLabel}
                    onChange={(e) => setInstLabel(e.target.value)}
                    placeholder="e.g. Design Approved"
                    className="h-8 text-xs shadow-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Amount (BDT)</Label>
                  <Input
                    value={instAmount}
                    onChange={(e) => setInstAmount(e.target.value)}
                    type="number"
                    placeholder="5000"
                    className="h-8 text-xs shadow-none"
                  />
                </div>
                <div className="space-y-1 flex items-end gap-1.5">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px]">Due Date</Label>
                    <Input
                      value={instDueDate}
                      onChange={(e) => setInstDueDate(e.target.value)}
                      type="date"
                      className="h-8 text-xs shadow-none px-1.5"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={addInstallment}
                    size="sm"
                    className="h-8 px-2 cursor-pointer shadow-none shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Installments List */}
              <div className="space-y-2 mt-2">
                {installments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">No custom installments added.</p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {installments.map((inst, index) => (
                      <div key={index} className="flex justify-between items-center text-xs bg-card border rounded-lg p-2.5 shadow-sm">
                        <div className="truncate flex-1">
                          <span className="font-semibold block truncate">{inst.label}</span>
                          <span className="text-[10px] text-muted-foreground">Due: {inst.due_date}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 pl-2">
                          <span className="font-bold">{formatCurrency(inst.amount, "BDT")}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInstallment(index)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/15 shrink-0"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Save Actions */}
          <div className="py-3 px-6 border-t shrink-0 bg-card/50">
            <SheetFooter>
              <Button type="submit" disabled={submitting} className="w-full cursor-pointer">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  editingAgreement ? "Save Changes" : "Create Agreement"
                )}
              </Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
