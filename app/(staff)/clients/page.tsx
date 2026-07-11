"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../components/ui/dialog";
import { Edit, Trash2, MoreHorizontal, Mail, Phone, Building2, MapPin, Loader2, Plus, Info, Globe, Tag, FileText, Briefcase, ListChecks, CheckCircle, LayoutGrid, List, Handshake } from "lucide-react";
import { formatCurrency, avatarColor } from "../../../lib/format";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Progress } from "../../../components/ui/progress";
import { cn } from "../../../lib/utils";

interface Client {
  id: string; company_name: string; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null;
  vat_bin: string | null; currency: "BDT" | "USD"; ltv: number; notes: string | null;
  website?: string | null; industry?: string | null;
  created_at: string;
  source?: string | null;
}

interface Project {
  id: string; name: string; client_id: string | null; status: string; progress: number; budget: number; currency: string;
}

const getSourceBadge = (source: string | null | undefined) => {
  if (!source || source === "direct") return null;
  switch (source) {
    case "freelancer":
      return <Badge className="bg-sky-500/10 text-sky-500 border border-sky-500/20 hover:bg-sky-500/10 text-[10px] py-0 px-1.5 font-normal h-5 shrink-0">Freelancer</Badge>;
    case "upwork":
      return <Badge className="bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 hover:bg-emerald-600/10 text-[10px] py-0 px-1.5 font-normal h-5 shrink-0">Upwork</Badge>;
    case "fiverr":
      return <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/10 text-[10px] py-0 px-1.5 font-normal h-5 shrink-0">Fiverr</Badge>;
    case "injaaz":
      return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 text-[10px] py-0 px-1.5 font-normal h-5 shrink-0">Injaaz</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal h-5 shrink-0 capitalize">{source}</Badge>;
  }
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("active");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: clientsData, error: clientsErr }, { data: projectsData, error: projectsErr }] = await Promise.all([
      supabase.from("clients").select("*").eq("is_vault_folder", false).order("ltv", { ascending: false }),
      supabase.from("projects").select("id, name, client_id, status, progress, budget, currency")
    ]);
    if (clientsErr) toast.error(clientsErr.message);
    if (projectsErr) toast.error(projectsErr.message);
    setClients((clientsData as any ?? []) as Client[]);
    setProjects((projectsData as any ?? []) as Project[]);
    setLoading(false);
  }

  async function deleteClient(id: string) {
    if (!confirm("Are you sure you want to delete this client?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Client deleted");
    void load();
    setIsDetailsOpen(false);
  }

  const totalLtvBDT = clients.filter((c) => c.currency === "BDT").reduce((s, c) => s + Number(c.ltv), 0);
  const totalLtvUSD = clients.filter((c) => c.currency === "USD").reduce((s, c) => s + Number(c.ltv), 0);

  const activeClients = clients.filter(c => {
    const projs = projects.filter(p => p.client_id === c.id);
    return projs.length === 0 || projs.some(p => p.status === 'active' || p.status === 'planning' || p.status === 'on_hold');
  });

  const inProgressClients = clients.filter(c => {
    const projs = projects.filter(p => p.client_id === c.id);
    return projs.some(p => p.status === 'active' || p.status === 'planning');
  });

  const completedClients = clients.filter(c => {
    const projs = projects.filter(p => p.client_id === c.id);
    return projs.length > 0 && projs.every(p => p.status === 'completed' || p.status === 'cancelled');
  });

  const directClients = clients.filter(c => !c.source || c.source === "direct");
  const freelancerClients = clients.filter(c => c.source === "freelancer");
  const injaazClients = clients.filter(c => c.source === "injaaz");
  const otherClients = clients.filter(c => c.source === "other");

  const getFilteredClients = () => {
    switch (activeTab) {
      case "in_progress":
        return inProgressClients;
      case "completed":
        return completedClients;
      case "direct":
        return directClients;
      case "freelancer":
        return freelancerClients;
      case "injaaz":
        return injaazClients;
      case "other":
        return otherClients;
      case "active":
      default:
        return activeClients;
    }
  };

  const filteredClients = getFilteredClients();
  const pageSize = 6;
  const totalItems = filteredClients.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentClients = filteredClients.slice(startIndex, startIndex + pageSize);

  const highlightClients = clients
    .filter(c => {
      const projs = projects.filter(p => p.client_id === c.id);
      return projs.some(p => p.status === "active" || p.status === "planning");
    })
    .slice(0, 3);

  const finalHighlights = [...highlightClients];
  if (finalHighlights.length < 3) {
    clients.forEach(c => {
      if (finalHighlights.length < 3 && !finalHighlights.some(fh => fh.id === c.id)) {
        finalHighlights.push(c);
      }
    });
  }

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} active accounts · {formatCurrency(totalLtvBDT, "BDT")} + {formatCurrency(totalLtvUSD, "USD")} lifetime value
          </p>
        </div>
        <Button onClick={() => { setEditingClient(null); setIsSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New client
        </Button>
      </div>
      {loading ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Active Clients</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="p-4 space-y-3 shadow-sm bg-card/65 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full rounded-xl" />
                  <Skeleton className="h-3 w-2/3" />
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-9 w-[300px] rounded-xl" />
            <Card className="bg-card/45 border-border/50 shadow-sm overflow-hidden p-6 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Highlights Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Active Clients</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {finalHighlights.map(c => {
                const clientProjects = projects.filter(p => p.client_id === c.id);
                const activeProj = clientProjects.find(p => p.status === "active" || p.status === "planning") || clientProjects[0];
                return (
                  <Card
                    key={c.id}
                    className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br from-primary/10 via-primary/5 to-card border border-primary/25 dark:from-primary/15 dark:via-primary/5 dark:to-card cursor-pointer relative shadow-sm"
                    onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}
                  >
                    <CardHeader className="pb-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className={avatarColor(c.company_name)}>
                            <Building2 className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{c.company_name}</CardTitle>
                          <CardDescription className="text-[10px] truncate">{c.contact_person || "—"}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3.5 text-[11px] text-muted-foreground min-h-[30px]">
                      {c.source && c.source !== "direct" ? (
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span>Billing Info</span>
                          <div className="flex items-center gap-1.5">
                            {getSourceBadge(c.source)}
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4.5 shrink-0">{c.currency}</Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span>Lifetime Value</span>
                          <span className="font-bold text-foreground">{formatCurrency(c.ltv, c.currency)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Tabs Listing Section */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-none bg-transparent">
              <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide bg-transparent border-none">
                <TabsList className="inline-flex w-auto md:grid md:w-full md:max-w-[850px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap md:grid-cols-7">
                  <TabsTrigger
                    value="active"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Active ({activeClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="in_progress"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    In Progress ({inProgressClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="completed"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Completed ({completedClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="direct"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Direct ({directClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="freelancer"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Freelancer ({freelancerClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="injaaz"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Injaazh ({injaazClients.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="other"
                    className="px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                  >
                    Others ({otherClients.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/40 shrink-0 mb-2">
                <Button
                  variant={viewMode === "card" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 rounded-lg cursor-pointer text-xs flex items-center gap-1.5"
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Card View
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 rounded-lg cursor-pointer text-xs flex items-center gap-1.5"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-3.5 w-3.5" /> List View
                </Button>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-2 outline-none">
              {currentClients.length === 0 ? (
                <Card className="bg-card/45 border-border/50 shadow-sm p-12 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
                  No accounts found in this tab.
                </Card>
              ) : viewMode === "card" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {currentClients.map(c => {
                      const clientProjects = projects.filter(p => p.client_id === c.id);
                      return (
                        <Card
                          key={c.id}
                          className="hover:shadow-elegant transition-all cursor-pointer group relative overflow-hidden bg-card/65 border border-border/50"
                          onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-12 w-12 shrink-0">
                                <AvatarFallback className={avatarColor(c.company_name)}>
                                  <Building2 className="h-5 w-5" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{c.company_name}</CardTitle>
                                <CardDescription className="text-xs truncate">{c.contact_person ?? "—"}</CardDescription>
                              </div>
                              <div onClick={e => e.stopPropagation()} className="shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer rounded-lg hover:bg-muted/50">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-32">
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}>
                                      <Info className="h-4 w-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingClient(c); setIsSheetOpen(true); }}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit Client
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => deleteClient(c.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pb-4">
                            <div className="space-y-1.5 text-xs text-muted-foreground min-h-[40px]">
                              {c.source && c.source !== "direct" ? (
                                <>
                                  {c.website && (
                                    <div className="flex items-center gap-2 truncate">
                                      <Globe className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                      <span className="truncate">{c.website.replace(/^https?:\/\//i, "")}</span>
                                    </div>
                                  )}
                                  {c.address && (
                                    <div className="flex items-center gap-2 truncate">
                                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                      <span className="truncate">{c.address}</span>
                                    </div>
                                  )}
                                  {!c.website && !c.address && (
                                    <div className="text-muted-foreground/60 italic text-[11px]">
                                      No profile links or country specified.
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {c.email && (
                                    <div className="flex items-center gap-2 truncate">
                                      <Mail className="h-3.5 w-3.5 shrink-0 text-primary/70" />{c.email}
                                    </div>
                                  )}
                                  {c.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5 shrink-0 text-primary/70" />{c.phone}
                                    </div>
                                  )}
                                  {!c.email && !c.phone && (
                                    <div className="text-muted-foreground/60 italic text-[11px]">
                                      No contact email or phone.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/30 h-7">
                              {c.source && c.source !== "direct" ? (
                                <>
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Billing Info</span>
                                  <div className="flex items-center gap-1.5">
                                    {getSourceBadge(c.source)}
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 shrink-0">{c.currency}</Badge>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime value</span>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 shrink-0">{c.currency}</Badge>
                                    <span className="text-foreground font-bold text-sm">{formatCurrency(Number(c.ltv), c.currency)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border border-border/40 p-4 bg-muted/10 shrink-0 flex-wrap gap-2 rounded-xl mt-4 bg-card/45">
                      <span className="text-xs text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} accounts
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="h-8 px-2 cursor-pointer text-xs"
                        >
                          Previous
                        </Button>

                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="h-8 w-8 cursor-pointer text-xs"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className="h-8 px-2 cursor-pointer text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="bg-card/45 border-border/50 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[220px]">Company</TableHead>
                          <TableHead>Contact Info</TableHead>
                          <TableHead>Projects Status</TableHead>
                          <TableHead className="text-right">Lifetime Value</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentClients.map(c => {
                          const clientProjects = projects.filter(p => p.client_id === c.id);
                          return (
                            <TableRow
                              key={c.id}
                              className="cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback className={avatarColor(c.company_name)}>
                                      <Building2 className="h-4 w-4" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-sm block truncate">{c.company_name}</span>
                                    <span className="text-[10px] text-muted-foreground block truncate">{c.industry || "General Industry"}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-xs space-y-0.5">
                                  {c.contact_person && <span className="font-medium text-foreground block">{c.contact_person}</span>}
                                  {c.email && (
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3 w-3 shrink-0" />{c.email}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {clientProjects.length === 0 ? (
                                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                      No projects
                                    </Badge>
                                  ) : (
                                    clientProjects.slice(0, 2).map(p => (
                                      <Badge
                                        key={p.id}
                                        variant="secondary"
                                        className="text-[10px] font-normal py-0 px-1.5 flex items-center gap-1 bg-muted/65"
                                      >
                                        <span className={cn(
                                          "h-1 w-1 rounded-full",
                                          p.status === "active" ? "bg-emerald-500" :
                                            p.status === "completed" ? "bg-blue-500" :
                                              p.status === "on_hold" ? "bg-amber-500" : "bg-muted-foreground"
                                        )} />
                                        {p.name}: {p.progress}%
                                      </Badge>
                                    ))
                                  )}
                                  {clientProjects.length > 2 && (
                                    <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5">
                                      +{clientProjects.length - 2} more
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-sm text-foreground">{formatCurrency(c.ltv, c.currency)}</span>
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-32">
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}>
                                      <Info className="h-4 w-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingClient(c); setIsSheetOpen(true); }}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit Client
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => deleteClient(c.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/40 p-4 bg-muted/10 shrink-0 flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} accounts
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="h-8 px-2 cursor-pointer text-xs"
                        >
                          Previous
                        </Button>

                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="h-8 w-8 cursor-pointer text-xs"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className="h-8 px-2 cursor-pointer text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedClient && (() => {
            const clientProjects = projects.filter(p => p.client_id === selectedClient.id);
            const activeCount = clientProjects.filter(p => p.status === 'active' || p.status === 'planning').length;
            const completedCount = clientProjects.filter(p => p.status === 'completed').length;
            return (
              <>
                <DialogHeader className="pb-2 border-b border-border/40">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className={avatarColor(selectedClient.company_name)}>
                        <Building2 className="h-7 w-7" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-xl font-bold text-foreground">{selectedClient.company_name}</DialogTitle>
                        {getSourceBadge(selectedClient.source)}
                      </div>
                      <DialogDescription className="text-xs">{selectedClient.industry || "General Industry"}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Quick Projects Stats Bar */}
                <div className="grid grid-cols-3 gap-2 text-center mt-3 bg-muted/40 p-2 rounded-xl border border-border/30">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total Projects</p>
                    <p className="text-xs font-bold text-foreground">{clientProjects.length}</p>
                  </div>
                  <div className="border-x border-border/30">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Active</p>
                    <p className="text-xs font-bold text-emerald-500">{activeCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Completed</p>
                    <p className="text-xs font-bold text-blue-500">{completedCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 py-3 text-xs max-h-[350px] overflow-y-auto pr-1">
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Contact Information</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-[10px] uppercase">
                          {selectedClient.source && selectedClient.source !== "direct" ? "Username / Contact" : "Contact Person"}
                        </p>
                        <p className="font-medium text-foreground">{selectedClient.contact_person || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-[10px] uppercase">Client Source</p>
                        <p className="font-medium text-foreground capitalize">{selectedClient.source || "Direct Client"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-[10px] uppercase">Email Address</p>
                        <p className="font-medium text-foreground truncate">{selectedClient.email || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-[10px] uppercase">Phone Number</p>
                        <p className="font-medium text-foreground">{selectedClient.phone || "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-[10px] uppercase">VAT / BIN</p>
                        <p className="font-medium text-foreground">{selectedClient.vat_bin || "—"}</p>
                      </div>
                      {selectedClient.website && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground text-[10px] uppercase">
                            {selectedClient.source && selectedClient.source !== "direct" ? "Platform Profile" : "Website"}
                          </p>
                          <a
                            href={selectedClient.website.startsWith("http") ? selectedClient.website : `https://${selectedClient.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium truncate"
                          >
                            <Globe className="h-3 w-3 shrink-0" />
                            {selectedClient.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/30">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {selectedClient.source && selectedClient.source !== "direct" ? "Country / Location" : "Location"}</h4>
                    <p className="text-muted-foreground">{selectedClient.address || "No address provided."}</p>
                  </div>

                  {/* Projects List Section */}
                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Briefcase className="h-3.5 w-3.5" /> Client Projects ({clientProjects.length})
                    </h4>
                    {clientProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2 text-center bg-muted/20 rounded-lg">
                        No projects registered for this client.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                        {clientProjects.map(p => (
                          <div key={p.id} className="bg-muted/40 p-2.5 rounded-xl border border-border/30 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate max-w-[200px]">{p.name}</span>
                              <Badge
                                variant={p.status === "active" ? "default" : "secondary"}
                                className={cn(
                                  "text-[9px] py-0 px-1.5 font-normal h-4",
                                  p.status === "active" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10",
                                  p.status === "completed" && "bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/10",
                                  p.status === "on_hold" && "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/10"
                                )}
                              >
                                {p.status}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Budget: {formatCurrency(p.budget, p.currency)}</span>
                              <span>Progress: {p.progress}%</span>
                            </div>
                            <Progress value={p.progress} className="h-1 bg-muted" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedClient.notes && (
                    <div className="space-y-1.5 pt-2 border-t border-border/30">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Internal Notes</h4>
                      <div className="bg-muted/50 p-2.5 rounded-xl text-muted-foreground italic">
                        "{selectedClient.notes}"
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3.5 bg-primary/5 rounded-xl border border-primary/10 mt-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {selectedClient.source && selectedClient.source !== "direct" ? "Contract Volume" : "Lifetime Revenue"}
                      </p>
                      <p className="text-lg font-black text-primary">{formatCurrency(selectedClient.ltv, selectedClient.currency)}</p>
                    </div>
                    <Badge className="h-fit">{selectedClient.currency}</Badge>
                  </div>
                </div>

                <DialogFooter className="flex-row gap-2 justify-end sm:justify-end border-t pt-3">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setIsDetailsOpen(false); setEditingClient(selectedClient); setIsSheetOpen(true); }}>
                    <Edit className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => deleteClient(selectedClient.id)}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ClientSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onCreated={load}
        editingClient={editingClient}
        clients={clients}
      />
    </div>
  );
}

function ClientSheet({ open, onOpenChange, onCreated, editingClient, clients }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; editingClient: Client | null; clients: Client[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    company_name: "", contact_person: "", email: "", phone: "",
    address: "", vat_bin: "", currency: "BDT" as any,
    ltv: "0", notes: "", website: "", industry: "",
    source: "direct",
  });

  const [billingType, setBillingType] = useState<string>("one_time");
  const [billingRate, setBillingRate] = useState("0");
  const [billingDuration, setBillingDuration] = useState("1");

  const [newSource, setNewSource] = useState("");
  const [newCurrency, setNewCurrency] = useState("");
  const [newBillingModel, setNewBillingModel] = useState("");

  const customSources = useMemo(() => {
    const predefined = ["direct", "freelancer", "injaaz", "other"];
    const unique = new Set(clients.map(c => c.source).filter((s): s is string => !!s && !predefined.includes(s)));
    return Array.from(unique);
  }, [clients]);

  const customCurrencies = useMemo(() => {
    const predefined = ["BDT", "USD"];
    const unique = new Set(clients.map(c => c.currency as string).filter((curr): curr is string => !!curr && !predefined.includes(curr)));
    return Array.from(unique);
  }, [clients]);

  const customBillingTypes = useMemo(() => {
    const predefined = ["one_time", "monthly", "yearly"];
    const unique = new Set<string>();
    clients.forEach(c => {
      if (c.notes) {
        const match = c.notes.match(/^\[Billing Model: ([^\]]+)\]/);
        if (match && match[1]) {
          const rawName = match[1].trim();
          const slug = rawName.toLowerCase().replace(/\s+/g, "_");
          if (!predefined.includes(slug)) {
            unique.add(rawName);
          }
        }
      }
    });
    return Array.from(unique);
  }, [clients]);

  useEffect(() => {
    if (editingClient) {
      let clientNotes = editingClient.notes || "";
      let modelName = "";
      let bType: any = "one_time";
      
      const match = clientNotes.match(/^\[Billing Model: ([^\]]+)\]/);
      if (match) {
        modelName = match[1];
        bType = modelName.trim().toLowerCase().replace(/\s+/g, "_");
        clientNotes = clientNotes.replace(/^\[Billing Model: [^\]]+\]\s*/, "");
      }
      
      setF({
        company_name: editingClient.company_name,
        contact_person: editingClient.contact_person || "",
        email: editingClient.email || "",
        phone: editingClient.phone || "",
        address: editingClient.address || "",
        vat_bin: editingClient.vat_bin || "",
        currency: editingClient.currency as any,
        ltv: editingClient.ltv.toString(),
        notes: clientNotes,
        website: editingClient.website || "",
        industry: editingClient.industry || "",
        source: editingClient.source || "direct",
      });
      
      const predefinedTypes = ["one_time", "monthly", "yearly"];
      if (modelName) {
        if (predefinedTypes.includes(bType)) {
          setBillingType(bType);
          setNewBillingModel("");
        } else {
          setBillingType("create_new");
          setNewBillingModel(modelName);
        }
      } else {
        setBillingType("one_time");
        setNewBillingModel("");
      }
      
      setBillingRate(editingClient.ltv.toString());
      setBillingDuration("1");
      setNewSource("");
      setNewCurrency("");
    } else {
      setF({
        company_name: "", contact_person: "", email: "", phone: "",
        address: "", vat_bin: "", currency: "BDT" as any, ltv: "0", notes: "",
        website: "", industry: "",
        source: "direct",
      });
      setBillingType("one_time");
      setBillingRate("0");
      setBillingDuration("1");
      setNewSource("");
      setNewCurrency("");
      setNewBillingModel("");
    }
  }, [editingClient, open]);

  useEffect(() => {
    const rate = Number(billingRate) || 0;
    const dur = Number(billingDuration) || 1;
    let computedLtv = 0;
    if (billingType === "one_time") {
      computedLtv = rate;
    } else {
      computedLtv = rate * dur;
    }
    setF(prev => ({ ...prev, ltv: computedLtv.toString() }));
  }, [billingType, billingRate, billingDuration]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let finalSource = f.source;
    if (f.source === "create_new") {
      finalSource = newSource.trim().toLowerCase().replace(/\s+/g, "_");
      if (!finalSource) {
        setSubmitting(false);
        return toast.error("Please enter a custom client source name.");
      }
    }

    let finalCurrency = f.currency;
    if (f.currency === "create_new") {
      finalCurrency = newCurrency.trim().toUpperCase() as any;
      if (!finalCurrency) {
        setSubmitting(false);
        return toast.error("Please enter a custom currency code.");
      }
    }

    let finalNotes = f.notes || "";
    if (billingType === "create_new") {
      if (!newBillingModel.trim()) {
        setSubmitting(false);
        return toast.error("Please enter a custom billing model name.");
      }
      finalNotes = `[Billing Model: ${newBillingModel.trim()}] ${finalNotes}`.trim();
    } else if (billingType === "monthly") {
      finalNotes = `[Billing Model: Monthly Retainer] ${finalNotes}`.trim();
    } else if (billingType === "yearly") {
      finalNotes = `[Billing Model: Yearly Retainer] ${finalNotes}`.trim();
    } else if (billingType === "one_time") {
      finalNotes = `[Billing Model: One-time] ${finalNotes}`.trim();
    }

    const clientData = {
      company_name: f.company_name,
      contact_person: f.contact_person || null,
      email: f.email || null, phone: f.phone || null,
      address: f.address || null, vat_bin: f.vat_bin || null,
      currency: finalCurrency, ltv: Number(f.ltv) || 0,
      notes: finalNotes || null, website: f.website || null,
      industry: f.industry || null,
      source: finalSource || "direct",
    };

    const { error } = editingClient
      ? await (supabase.from("clients") as any).update(clientData).eq("id", editingClient.id)
      : await (supabase.from("clients") as any).insert(clientData);

    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(editingClient ? "Client updated" : "Client created");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full p-0 w-full sm:max-w-lg">
        {/* Fixed Header */}
        <div className="py-3 px-6 border-b border-border/40 shrink-0">
          <SheetHeader>
            <SheetTitle>{editingClient ? "Edit Client" : "New Client"}</SheetTitle>
            <SheetDescription>
              {editingClient ? "Update client profile details." : "Add a new account to your CRM."}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Form Wrapper */}
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 pt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/30">
              <Fld label="Client Source">
                <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct Client</SelectItem>
                    <SelectItem value="freelancer">Freelancer.com</SelectItem>
                    <SelectItem value="injaaz">Shared with Injaaz</SelectItem>
                    <SelectItem value="other">Other / Shared</SelectItem>
                    {customSources.map(src => (
                      <SelectItem key={src} value={src} className="capitalize">{src.replace(/_/g, " ")}</SelectItem>
                    ))}
                    <SelectItem value="create_new" className="font-semibold text-primary cursor-pointer border-t border-border mt-1">+ Create New Source...</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label={f.source !== "direct" && f.source !== "create_new" ? "Client Name" : "Company Name"}>
                <Input required placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. Tina Wade" : "e.g. MACS School and College"} value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
              </Fld>
            </div>

            {f.source === "create_new" && (
              <div className="space-y-1.5 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <Label className="text-xs font-semibold text-primary">Custom Source Name</Label>
                <Input
                  placeholder="e.g. LinkedIn / Web Search"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Fld label={f.source !== "direct" && f.source !== "create_new" ? "Username / Contact" : "Contact Person"}>
                <Input placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. tina_wade" : "e.g. Md Nurul Islam"} value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} />
              </Fld>
              <Fld label="Industry">
                <Input placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. Healthcare, Tech" : "e.g. Education"} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
              </Fld>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Fld label="Email">
                <Input type="email" placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. (Optional) tina@example.com" : "e.g. info@macsschool.edu.bd"} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </Fld>
              <Fld label="Phone">
                <Input placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. (Optional) +1..." : "e.g. 01896220299"} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </Fld>
            </div>

            <Fld label={f.source !== "direct" && f.source !== "create_new" ? "Platform Profile / Website" : "Website"}>
              <Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. https://freelancer.com/u/tinawade" : "e.g. https://macsschool.edu.bd"} />
            </Fld>

            <Fld label={f.source !== "direct" && f.source !== "create_new" ? "Country / Location" : "Address"}>
              <Input placeholder={f.source !== "direct" && f.source !== "create_new" ? "e.g. United States" : "e.g. Jalalpur, Pabna"} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Fld>

            <div className="grid grid-cols-2 gap-3">
              <Fld label="VAT / BIN">
                <Input placeholder="e.g. 1234567890" value={f.vat_bin} onChange={(e) => setF({ ...f, vat_bin: e.target.value })} />
              </Fld>
              <Fld label="Currency">
                <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BDT">BDT</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    {customCurrencies.map(curr => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                    <SelectItem value="create_new" className="font-semibold text-primary cursor-pointer border-t border-border mt-1">+ Create New Currency...</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
            </div>

            {f.currency === "create_new" && (
              <div className="space-y-1.5 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <Label className="text-xs font-semibold text-primary">Custom Currency Code</Label>
                <Input
                  placeholder="e.g. EUR / GBP"
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>
            )}

            {/* LTV Calculator fields */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
              <Fld label="Billing Model">
                <Select value={billingType} onValueChange={(v) => setBillingType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time / Milestone</SelectItem>
                    <SelectItem value="monthly">Monthly Retainer</SelectItem>
                    <SelectItem value="yearly">Yearly Retainer</SelectItem>
                    {customBillingTypes.map(b => {
                      const slug = b.trim().toLowerCase().replace(/\s+/g, "_");
                      return (
                        <SelectItem key={slug} value={slug}>{b}</SelectItem>
                      );
                    })}
                    <SelectItem value="create_new" className="font-semibold text-primary cursor-pointer border-t border-border mt-1">+ Create New Billing Model...</SelectItem>
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label={
                billingType === "one_time" ? "Project Cost" :
                  billingType === "monthly" ? "Monthly Rate" :
                    billingType === "yearly" ? "Annual Rate" : "Rate per Period"
              }>
                <Input type="number" placeholder={billingType === "one_time" ? "e.g. 5000" : billingType === "monthly" ? "e.g. 1500" : billingType === "yearly" ? "e.g. 12000" : "e.g. 1000"} value={billingRate} onChange={(e) => setBillingRate(e.target.value)} />
              </Fld>
            </div>

            {billingType === "create_new" && (
              <div className="space-y-1.5 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <Label className="text-xs font-semibold text-primary">Custom Billing Model Name</Label>
                <Input
                  placeholder="e.g. Weekly Retainer / Milestone Contract"
                  value={newBillingModel}
                  onChange={(e) => setNewBillingModel(e.target.value)}
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>
            )}

            {billingType !== "one_time" && (
              <Fld label={
                billingType === "monthly" ? "Duration (Months)" :
                  billingType === "yearly" ? "Duration (Years)" : "Duration (Periods)"
              }>
                <Input type="number" min="1" placeholder={billingType === "monthly" ? "e.g. 12" : billingType === "yearly" ? "e.g. 3" : "e.g. 4"} value={billingDuration} onChange={(e) => setBillingDuration(e.target.value)} />
              </Fld>
            )}

            <Fld label="Calculated Lifetime Value">
              <Input type="number" disabled className="bg-muted text-muted-foreground font-semibold" placeholder="Calculated automatically" value={f.ltv} />
            </Fld>

            <Fld label="Notes">
              <Textarea placeholder="e.g. Custom billing notes, SLA timelines..." value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} />
            </Fld>
          </div>

          {/* Fixed Footer */}
          <div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">
            <SheetFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingClient ? "Update Client" : "Create Client"}
              </Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
