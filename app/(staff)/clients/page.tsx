"use client";

import { useEffect, useState } from "react";
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
import { Edit, Trash2, MoreHorizontal, Mail, Phone, Building2, MapPin, Loader2, Plus, Info, Globe, Tag, FileText, Briefcase, ListChecks, CheckCircle } from "lucide-react";
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
}

interface Project {
  id: string; name: string; client_id: string | null; status: string; progress: number; budget: number; currency: string;
}

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

  const getFilteredClients = () => {
    switch (activeTab) {
      case "in_progress":
        return inProgressClients;
      case "completed":
        return completedClients;
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {finalHighlights.map(c => {
              const clientProjects = projects.filter(p => p.client_id === c.id);
              const activeProj = clientProjects.find(p => p.status === "active" || p.status === "planning") || clientProjects[0];
              return (
                <Card 
                  key={c.id} 
                  className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-card/65 border border-border/50 cursor-pointer relative"
                  onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }}
                >
                  <CardHeader className="pb-2.5">
                    <div className="flex items-center justify-between">
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
                      <Badge variant="outline" className="text-[10px]">{c.currency}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-3.5 text-[11px] text-muted-foreground">
                    {activeProj ? (
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 space-y-1.5">
                        <div className="flex items-center justify-between font-medium text-foreground">
                          <span className="truncate">{activeProj.name}</span>
                          <span>{activeProj.progress}%</span>
                        </div>
                        <Progress value={activeProj.progress} className="h-1" />
                      </div>
                    ) : (
                      <div className="text-[10px] italic py-2 text-center bg-muted/30 rounded-xl text-muted-foreground">
                        No active projects
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span>Lifetime Value</span>
                      <span className="font-bold text-foreground">{formatCurrency(c.ltv, c.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabs Listing Section */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide bg-transparent border-none">
              <TabsList className="inline-flex w-auto md:grid md:w-full md:max-w-[500px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap md:grid-cols-3">
                <TabsTrigger
                  value="active"
                  className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                >
                  <Briefcase className="h-4 w-4" /> Active ({activeClients.length})
                </TabsTrigger>
                <TabsTrigger
                  value="in_progress"
                  className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                >
                  <Loader2 className="h-4 w-4" /> In Progress ({inProgressClients.length})
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"
                >
                  <CheckCircle className="h-4 w-4" /> Completed ({completedClients.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="mt-2 outline-none">
              {currentClients.length === 0 ? (
                <Card className="bg-card/45 border-border/50 shadow-sm p-12 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
                  No accounts found in this tab.
                </Card>
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
                                        className="text-[10px] font-normal py-0 px-1.5 flex items-center gap-1 bg-muted/60"
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
          {selectedClient && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className={avatarColor(selectedClient.company_name)}>
                      <Building2 className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">{selectedClient.company_name}</DialogTitle>
                    <DialogDescription>{selectedClient.industry || "General Industry"}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-1 gap-6 py-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Info className="h-4 w-4" /> Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Contact Person</p>
                      <p>{selectedClient.contact_person || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Email Address</p>
                      <p>{selectedClient.email || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">Phone Number</p>
                      <p>{selectedClient.phone || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-[10px] uppercase">VAT / BIN</p>
                      <p>{selectedClient.vat_bin || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</h4>
                  <p className="text-sm">{selectedClient.address || "No address provided."}</p>
                </div>

                {selectedClient.notes && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Internal Notes</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground italic">
                      "{selectedClient.notes}"
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime Revenue</p>
                    <p className="text-xl font-black text-primary">{formatCurrency(selectedClient.ltv, selectedClient.currency)}</p>
                  </div>
                  <Badge className="h-fit">{selectedClient.currency}</Badge>
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 justify-end sm:justify-end border-t pt-4">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setIsDetailsOpen(false); setEditingClient(selectedClient); setIsSheetOpen(true); }}>
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => deleteClient(selectedClient.id)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClientSheet 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        onCreated={load} 
        editingClient={editingClient} 
      />
    </div>
  );
}

function ClientSheet({ open, onOpenChange, onCreated, editingClient }: { 
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; editingClient: Client | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    company_name: "", contact_person: "", email: "", phone: "",
    address: "", vat_bin: "", currency: "BDT" as "BDT" | "USD",
    ltv: "0", notes: "", website: "", industry: "",
  });

  useEffect(() => {
    if (editingClient) {
      setF({
        company_name: editingClient.company_name,
        contact_person: editingClient.contact_person || "",
        email: editingClient.email || "",
        phone: editingClient.phone || "",
        address: editingClient.address || "",
        vat_bin: editingClient.vat_bin || "",
        currency: editingClient.currency,
        ltv: editingClient.ltv.toString(),
        notes: editingClient.notes || "",
        website: editingClient.website || "",
        industry: editingClient.industry || "",
      });
    } else {
      setF({
        company_name: "", contact_person: "", email: "", phone: "",
        address: "", vat_bin: "", currency: "BDT", ltv: "0", notes: "",
        website: "", industry: "",
      });
    }
  }, [editingClient, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    const clientData = {
      company_name: f.company_name,
      contact_person: f.contact_person || null,
      email: f.email || null, phone: f.phone || null,
      address: f.address || null, vat_bin: f.vat_bin || null,
      currency: f.currency, ltv: Number(f.ltv) || 0,
      notes: f.notes || null, website: f.website || null,
      industry: f.industry || null,
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
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingClient ? "Edit Client" : "New Client"}</SheetTitle>
          <SheetDescription>{editingClient ? "Update client profile details." : "Add a new account to your CRM."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <Fld label="Company name"><Input required value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Contact person"><Input value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} /></Fld>
            <Fld label="Industry"><Input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Fld>
            <Fld label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Fld>
          </div>
          <Fld label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://..." /></Fld>
          <Fld label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="VAT / BIN"><Input value={f.vat_bin} onChange={(e) => setF({ ...f, vat_bin: e.target.value })} /></Fld>
            <Fld label="Currency">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "BDT" | "USD" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BDT">BDT</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld label="Lifetime value"><Input type="number" value={f.ltv} onChange={(e) => setF({ ...f, ltv: e.target.value })} /></Fld>
          <Fld label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></Fld>
          <SheetFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingClient ? "Update Client" : "Create Client"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
