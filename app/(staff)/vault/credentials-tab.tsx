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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Checkbox } from "../../../components/ui/checkbox";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Key, Server, Globe, Mail, Cpu, ShieldAlert, Eye, EyeOff, Copy, Check, Plus, Edit, Trash2, Search, Users, History, Loader2, ExternalLink, Shield, ShieldCheck, Folder, ChevronLeft, Maximize2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { formatDate } from "../../../lib/format";

type CredentialCategory = "hosting" | "social_media" | "email" | "cpanel" | "admin_panel" | "other" | string;

interface SharedStaffMember {
  staff_id: string;
  full_name: string;
  permission_level: "view" | "edit";
}

interface CustomField {
  label: string;
  value: string;
}

interface CredentialRow {
  id: string;
  title: string;
  category: CredentialCategory;
  client_id: string | null;
  url: string | null;
  username: string | null;
  notes: string | null;
  custom_fields: CustomField[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  has_password: boolean;
  permission_level: "view" | "edit";
  shared_with: SharedStaffMember[];
}

interface Client {
  id: string;
  company_name: string;
  permission_level?: "view" | "edit";
}

interface Profile {
  id: string;
  full_name: string;
}

interface AuditLog {
  id: string;
  credential_title?: string;
  folder_name?: string;
  staff_name?: string;
  action: "view" | "copy";
  created_at: string;
}

const DEFAULT_CATEGORIES: { value: string; label: string; icon: any; color: string }[] = [
  { value: "hosting", label: "Hosting", icon: Server, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "social_media", label: "Social Media", icon: Globe, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "email", label: "Email", icon: Mail, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "cpanel", label: "cPanel", icon: Cpu, color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  { value: "admin_panel", label: "Admin Panel", icon: ShieldAlert, color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  { value: "other", label: "Other", icon: Key, color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
];

const FOLDER_GRADIENTS = [
  "from-blue-500/10 via-card/75 to-indigo-500/5 hover:from-blue-500/15 hover:to-indigo-500/10 border-blue-500/20 hover:border-blue-500/40",
  "from-purple-500/10 via-card/75 to-pink-500/5 hover:from-purple-500/15 hover:to-pink-500/10 border-purple-500/20 hover:border-purple-500/40",
  "from-emerald-500/10 via-card/75 to-teal-500/5 hover:from-emerald-500/15 hover:to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
  "from-amber-500/10 via-card/75 to-orange-500/5 hover:from-amber-500/15 hover:to-orange-500/10 border-amber-500/20 hover:border-amber-500/40",
  "from-rose-500/10 via-card/75 to-red-500/5 hover:from-rose-500/15 hover:to-red-500/10 border-rose-500/20 hover:border-rose-500/40",
  "from-cyan-500/10 via-card/75 to-blue-500/5 hover:from-cyan-500/15 hover:to-blue-500/10 border-cyan-500/20 hover:border-cyan-500/40"
];

const FOLDER_COLORS = [
  { text: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", hoverBg: "group-hover:bg-blue-500/20", hoverText: "group-hover:text-blue-400" },
  { text: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", hoverBg: "group-hover:bg-purple-500/20", hoverText: "group-hover:text-purple-400" },
  { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", hoverBg: "group-hover:bg-emerald-500/20", hoverText: "group-hover:text-emerald-400" },
  { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", hoverBg: "group-hover:bg-amber-500/20", hoverText: "group-hover:text-amber-400" },
  { text: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", hoverBg: "group-hover:bg-rose-500/20", hoverText: "group-hover:text-rose-400" },
  { text: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20", hoverBg: "group-hover:bg-cyan-500/20", hoverText: "group-hover:text-cyan-400" },
];

export function CredentialsTab({ clients, onRefreshClients }: { clients: Client[]; onRefreshClients?: () => Promise<void> | void }) {
  const { profile, roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");

  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | string>("all");

  // Folder navigation state: null = Folders Grid view, "internal" = Internal credentials, client_id = client folder
  const [activeFolder, setActiveFolder] = useState<null | "internal" | string>(null);

  // Folder creation state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Fetch profiles and sharing details
  const [activeStaff, setActiveStaff] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogsSheet, setShowLogsSheet] = useState(false);

  // Password decryption maps
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add/Edit sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingCred, setEditingCred] = useState<CredentialRow | null>(null);
  const [formPasswordVisible, setFormPasswordVisible] = useState(false);

  // Quick View dialog state
  const [quickViewCred, setQuickViewCred] = useState<CredentialRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Form values
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sharing, setSharing] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});

  // Folder actions state
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState("");
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);

  const [shareFolderOpen, setShareFolderOpen] = useState(false);
  const [shareFolderId, setShareFolderId] = useState("");
  const [shareFolderName, setShareFolderName] = useState("");
  const [sharingFolderSubmitting, setSharingFolderSubmitting] = useState(false);
  const [folderSharingMap, setFolderSharingMap] = useState<Record<string, { selected: boolean; level: "view" | "edit" }>>({});

  const handleOpenRenameFolder = (id: string, name: string) => {
    setRenameFolderId(id);
    setRenameFolderName(name);
    setRenameFolderOpen(true);
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolderName.trim()) return toast.error("Folder name is required");
    setRenamingFolder(true);
    try {
      const res = await fetchWithAuth("/api/vault/folders", {
        method: "PUT",
        body: JSON.stringify({ id: renameFolderId, company_name: renameFolderName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename folder");
      }
      toast.success("Folder renamed successfully");
      setRenameFolderOpen(false);
      if (onRefreshClients) {
        await onRefreshClients();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete folder "${name}"? All credentials inside this folder will also be deleted.`)) return;
    try {
      const res = await fetchWithAuth(`/api/vault/folders?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete folder");
      }
      toast.success("Folder deleted successfully");
      if (onRefreshClients) {
        await onRefreshClients();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenShareFolder = async (id: string, name: string) => {
    setShareFolderId(id);
    setShareFolderName(name);
    setShareFolderOpen(true);

    const initialFolderSharing: Record<string, { selected: boolean; level: "view" | "edit" }> = {};
    activeStaff.forEach(s => {
      initialFolderSharing[s.id] = { selected: false, level: "view" };
    });
    setFolderSharingMap(initialFolderSharing);

    try {
      const res = await fetchWithAuth(`/api/vault/folders/share?client_id=${id}`);
      if (res.ok) {
        const existingShares: { user_id: string; permission_level: "view" | "edit" }[] = await res.json();
        setFolderSharingMap(prev => {
          const updated = { ...prev };
          existingShares.forEach(s => {
            if (updated[s.user_id]) {
              updated[s.user_id] = {
                selected: true,
                level: s.permission_level,
              };
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.error("Error loading folder shares:", err);
    }
  };

  const handleFolderShareSubmit = async () => {
    setSharingFolderSubmitting(true);
    const shares = Object.entries(folderSharingMap)
      .filter(([_, val]) => val.selected)
      .map(([user_id, val]) => ({
        user_id,
        permission_level: val.level,
      }));

    try {
      const res = await fetchWithAuth("/api/vault/folders/share", {
        method: "POST",
        body: JSON.stringify({ client_id: shareFolderId, shares }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update folder sharing");
      }
      toast.success("Folder sharing updated successfully");
      setShareFolderOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSharingFolderSubmitting(false);
    }
  };

  const handleFolderShareCheck = (staffId: string, checked: boolean) => {
    setFolderSharingMap(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], selected: checked },
    }));
  };

  const handleFolderShareLevelChange = (staffId: string, level: "view" | "edit") => {
    setFolderSharingMap(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], level },
    }));
  };

  useEffect(() => {
    void loadCredentials();
    void loadActiveStaff();
  }, []);

  // API Call Wrapper with JWT Authorization
  async function fetchWithAuth(urlStr: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(urlStr, { ...options, headers });
  }

  async function loadCredentials() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/vault/credentials");
      if (!res.ok) throw new Error("Failed to load credentials");
      const data = await res.json();
      setCredentials(data);
    } catch (err: any) {
      toast.error(err.message || "Could not retrieve credentials");
    } finally {
      setLoading(false);
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return toast.error("Folder name is required");
    setCreatingFolder(true);
    try {
      const res = await fetchWithAuth("/api/vault/folders", {
        method: "POST",
        body: JSON.stringify({ company_name: newFolderName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create folder");
      }
      toast.success("Folder created successfully");
      setNewFolderName("");
      setCreateFolderOpen(false);
      if (onRefreshClients) {
        await onRefreshClients();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  async function loadActiveStaff() {
    try {
      const { data: roleData } = await supabase
        .from("user_roles" as any)
        .select("user_id")
        .in("role", ["staff", "project_manager", "super_admin"]);

      const userIds = [...new Set((roleData || []).map((r: any) => r.user_id as string))];
      if (userIds.length === 0) return;

      const { data: activeEmps } = await supabase
        .from("employees" as any)
        .select("profile_id")
        .in("profile_id", userIds)
        .neq("status", "disabled");

      const activeProfileIds = (activeEmps || []).map((e: any) => e.profile_id).filter(Boolean);
      if (activeProfileIds.length === 0) return;

      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", activeProfileIds)
        .order("full_name");

      setActiveStaff(staffProfiles || []);
    } catch (err) {
      console.error("Error loading active staff:", err);
    }
  }

  async function loadAuditLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetchWithAuth("/api/vault/audit-logs");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load audit logs");
      }
      const data = await res.json();
      setAuditLogs(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }

  // Handle Decryption
  async function handleDecrypt(id: string, action: "view" | "copy") {
    try {
      const res = await fetchWithAuth("/api/vault/credentials/decrypt", {
        method: "POST",
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to decrypt password");
      }
      const data = await res.json();
      return data.password as string;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    }
  }

  const handleToggleReveal = async (id: string) => {
    if (visibleMap[id]) {
      setVisibleMap(prev => ({ ...prev, [id]: false }));
    } else {
      if (decryptedMap[id]) {
        setVisibleMap(prev => ({ ...prev, [id]: true }));
      } else {
        const pass = await handleDecrypt(id, "view");
        if (pass !== null) {
          setDecryptedMap(prev => ({ ...prev, [id]: pass }));
          setVisibleMap(prev => ({ ...prev, [id]: true }));
        }
      }
    }
  };

  const handleCopyPassword = async (id: string) => {
    let pass = decryptedMap[id];
    if (!pass) {
      const fetchedPass = await handleDecrypt(id, "copy");
      if (fetchedPass !== null) {
        pass = fetchedPass;
        setDecryptedMap(prev => ({ ...prev, [id]: fetchedPass }));
      }
    }
    if (pass) {
      await navigator.clipboard.writeText(pass);
      toast.success("Password copied to clipboard!");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Delete Action
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" credential?`)) return;
    try {
      const res = await fetchWithAuth(`/api/vault/credentials?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete credential");
      toast.success("Credential deleted successfully");
      void loadCredentials();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Dynamic Categories gathered from DB + Default Categories
  const customCategories = useMemo(() => {
    const defaultVals = DEFAULT_CATEGORIES.map(dc => dc.value);
    const saved = credentials.map(c => c.category).filter(c => c && !defaultVals.includes(c));
    return [...new Set(saved)];
  }, [credentials]);

  const allCategoryOptions = useMemo(() => {
    const defaults = DEFAULT_CATEGORIES.map(c => ({ value: c.value, label: c.label }));
    const customs = customCategories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));
    return [...defaults, ...customs];
  }, [customCategories]);

  // Form Operations
  const openAddSheet = () => {
    setEditingCred(null);
    setTitle("");
    setCategory("other");
    setNewCategoryName("");
    setClientId(activeFolder || "");
    setUrl("");
    setUsername("");
    setPassword("");
    setFormPasswordVisible(false);
    setNotes("");
    setCustomFields([]);

    // Clear sharing
    const initialSharing: Record<string, { selected: boolean; level: "view" | "edit" }> = {};
    activeStaff.forEach(s => {
      initialSharing[s.id] = { selected: false, level: "view" };
    });
    setSharing(initialSharing);

    setFormOpen(true);
  };

  const openEditSheet = (cred: CredentialRow) => {
    setEditingCred(cred);
    setTitle(cred.title);

    const isDefault = DEFAULT_CATEGORIES.some(dc => dc.value === cred.category) || customCategories.includes(cred.category);
    if (isDefault) {
      setCategory(cred.category);
      setNewCategoryName("");
    } else {
      setCategory("create_new");
      setNewCategoryName(cred.category);
    }

    setClientId(cred.client_id || "");
    setUrl(cred.url || "");
    setUsername(cred.username || "");
    setPassword("");
    setFormPasswordVisible(false);
    setNotes(cred.notes || "");
    setCustomFields(cred.custom_fields || []);

    // Prepare sharing values
    const currentSharing: Record<string, { selected: boolean; level: "view" | "edit" }> = {};
    activeStaff.forEach(s => {
      const match = cred.shared_with.find(w => w.staff_id === s.id);
      currentSharing[s.id] = {
        selected: !!match,
        level: match ? match.permission_level : "view",
      };
    });
    setSharing(currentSharing);

    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return toast.error("Title is required");
    if (!clientId) return toast.error("Please select a folder");
    if (!editingCred && !password) return toast.error("Password is required for new credentials");

    let finalCategory = category;
    if (category === "create_new") {
      if (!newCategoryName.trim()) return toast.error("Please specify a category name");
      finalCategory = newCategoryName.trim().toLowerCase();
    }

    setFormSubmitting(true);

    const shared_staff = Object.entries(sharing)
      .filter(([_, value]) => value.selected)
      .map(([staff_id, value]) => ({
        staff_id,
        permission_level: value.level,
      }));

    const validCustomFields = customFields.filter(f => f.label.trim() && f.value.trim());

    const payload = {
      id: editingCred?.id,
      title,
      category: finalCategory,
      client_id: clientId || null,
      url,
      username,
      password: password || undefined,
      notes,
      custom_fields: validCustomFields,
      shared_staff,
    };

    try {
      const method = editingCred ? "PUT" : "POST";
      const res = await fetchWithAuth("/api/vault/credentials", {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credential");
      }

      toast.success(editingCred ? "Credential updated successfully" : "Credential added successfully");
      setFormOpen(false);
      void loadCredentials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleShareCheck = (staffId: string, checked: boolean) => {
    setSharing(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        selected: checked,
      },
    }));
  };

  const handleShareLevelChange = (staffId: string, level: "view" | "edit") => {
    setSharing(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        level,
      },
    }));
  };

  // Folder counter mappings
  const folderCounts = useMemo(() => {
    const m: Record<string, number> = {
      all: credentials.length,
      internal: credentials.filter(c => !c.client_id).length,
    };
    credentials.forEach(c => {
      if (c.client_id) {
        m[c.client_id] = (m[c.client_id] ?? 0) + 1;
      }
    });
    return m;
  }, [credentials]);

  // Filter and Search Lists
  const filteredCredentials = useMemo(() => {
    return credentials.filter(c => {
      const matchesQ =
        !q ||
        c.title.toLowerCase().includes(q.toLowerCase()) ||
        (c.username && c.username.toLowerCase().includes(q.toLowerCase())) ||
        (c.url && c.url.toLowerCase().includes(q.toLowerCase()));

      const matchesCat = selectedCategory === "all" || c.category === selectedCategory;

      const matchesFolder =
        activeFolder === null || // In main folder view, show all only if search is active
        (activeFolder === "internal" && !c.client_id) ||
        c.client_id === activeFolder;

      return matchesQ && matchesCat && (q ? true : matchesFolder);
    });
  }, [credentials, q, selectedCategory, activeFolder]);

  const clientName = (id: string | null) => {
    if (!id) return "Personal";
    return clients.find(c => c.id === id)?.company_name || "—";
  };

  const getFaviconUrl = (urlStr: string | null) => {
    try {
      if (!urlStr) return null;
      const cleanUrl = urlStr.startsWith("http") ? urlStr : `https://${urlStr}`;
      const hostname = new URL(cleanUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  const getCategoryInfo = (catVal: string) => {
    const found = DEFAULT_CATEGORIES.find(c => c.value === catVal);
    if (found) return found;
    return {
      value: catVal,
      label: catVal.charAt(0).toUpperCase() + catVal.slice(1),
      icon: Key,
      color: "bg-slate-500/10 text-slate-500 border-slate-500/20"
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          {/* Global search input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search across all folders..."
              className="pl-9"
            />
          </div>

          {/* Render category filter only when inside a folder or during search */}
          {(activeFolder !== null || q) && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px] cursor-pointer">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">All Categories</SelectItem>
                {allCategoryOptions.map(c => (
                  <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={openAddSheet}
            className="flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Credential
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateFolderOpen(true)}
            className="flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:!bg-emerald-500/20 hover:!text-emerald-700 dark:hover:!text-emerald-300 hover:border-emerald-500/30 transition-colors"
          >
            <Folder className="h-4 w-4 text-emerald-500" /> Create Folder
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setShowLogsSheet(true);
                void loadAuditLogs();
              }}
              className="flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
            >
              <History className="h-4 w-4" /> Audit Logs
            </Button>
          )}
        </div>
      </div>

      {/* Main layout drill-down folder view vs search results */}
      {q ? (
        // Search Results Overlay
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Search Results for "{q}" ({filteredCredentials.length} found)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs cursor-pointer text-primary"
              onClick={() => setQ("")}
            >
              Clear Search
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCredentials.map(c => {
              const catInfo = getCategoryInfo(c.category);
              const CatIcon = catInfo.icon;
              const favUrl = getFaviconUrl(c.url);

              return (
                <Card key={c.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-muted-foreground/20 bg-card/65 backdrop-blur-sm border border-border/50">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center overflow-hidden border border-border shrink-0">
                        {favUrl ? (
                          <img
                            src={favUrl}
                            alt="logo"
                            className="h-6 w-6 object-contain"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <CatIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold tracking-tight truncate max-w-[140px]">{c.title}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[140px] mt-0.5">
                          {c.url ? (
                            <a
                              href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1 text-primary inline-flex cursor-pointer"
                            >
                              {c.url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "No login link"
                          )}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge variant="outline" className={`${catInfo.color} border px-2 py-0.5 font-medium`}>
                      <CatIcon className="h-3 w-3 mr-1" /> {catInfo.label}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2.5 bg-muted/30 rounded-xl p-3.5 border border-border/40">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium text-xs">Username</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-foreground select-all text-xs max-w-[120px] truncate">
                            {c.username || "—"}
                          </span>
                          {c.username && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 cursor-pointer"
                              onClick={async () => {
                                await navigator.clipboard.writeText(c.username || "");
                                toast.success("Username copied!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm border-t border-border/40 pt-2.5">
                        <span className="text-muted-foreground font-medium text-xs">Password</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-foreground font-semibold text-xs tracking-wider">
                            {visibleMap[c.id] ? decryptedMap[c.id] : "••••••••"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 cursor-pointer"
                            onClick={() => handleToggleReveal(c.id)}
                          >
                            {visibleMap[c.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 cursor-pointer"
                            onClick={() => handleCopyPassword(c.id)}
                          >
                            {copiedId === c.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="font-semibold text-xs">Folder:</span>
                        <Badge variant="secondary" className="px-1.5 py-0">
                          {clientName(c.client_id)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2.5 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/5 cursor-pointer mr-auto"
                        onClick={() => {
                          setQuickViewCred(c);
                          setQuickViewOpen(true);
                        }}
                      >
                        <Maximize2 className="h-3.5 w-3.5 mr-1" /> Quick View
                      </Button>
                      {c.permission_level === "edit" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => openEditSheet(c)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={() => handleDelete(c.id, c.title)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : activeFolder === null ? (
        // Folders Grid View
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Select a Folder to view credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Clients folder cards */}
            {clients.map((c, index) => {
              const count = folderCounts[c.id] ?? 0;
              const gradient = FOLDER_GRADIENTS[index % FOLDER_GRADIENTS.length];
              const theme = FOLDER_COLORS[index % FOLDER_COLORS.length];
              const hasEditPermission = isAdmin || c.permission_level === "edit";

              return (
                <Card
                  key={c.id}
                  onClick={() => setActiveFolder(c.id)}
                  className={`group cursor-pointer border bg-gradient-to-br ${gradient} transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 relative`}
                >
                  {hasEditPermission && (
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-full">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenShareFolder(c.id, c.company_name)} className="cursor-pointer">
                            <Users className="h-4 w-4 mr-2" /> Share Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenRenameFolder(c.id, c.company_name)} className="cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" /> Rename Folder
                          </DropdownMenuItem>
                          {hasEditPermission && (
                            <DropdownMenuItem onClick={() => handleDeleteFolder(c.id, c.company_name)} className="text-destructive cursor-pointer hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Folder
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col items-start gap-4">
                    <div className={`h-12 w-12 rounded-2xl ${theme.bg} flex items-center justify-center border ${theme.border} shrink-0 ${theme.hoverBg} transition-colors`}>
                      <Folder className={`h-6 w-6 ${theme.text}`} />
                    </div>
                    <div className="min-w-0 w-full pr-6">
                      <h3 className={`font-semibold text-base text-foreground truncate ${theme.hoverText} transition-colors`}>{c.company_name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {count} saved accounts
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        // Folders Drill Down view
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setActiveFolder(null);
                setSelectedCategory("all");
              }}
              className="h-8.5 w-8.5 rounded-xl cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span>Vault</span>
                <span>/</span>
                <span className="hover:underline cursor-pointer" onClick={() => setActiveFolder(null)}>Folders</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {activeFolder === "internal" ? "Personal Credentials" : clientName(activeFolder)}
              </h2>
            </div>
            <Badge variant="secondary" className="ml-2 font-mono h-5.5 flex items-center">
              {filteredCredentials.length} items
            </Badge>
          </div>

          {/* Cards Grid belonging to the active folder */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading folder credentials...</p>
            </div>
          ) : filteredCredentials.length === 0 ? (
            <Card className="border-dashed bg-card/30">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Key className="h-10 w-10 mb-3 text-muted-foreground/60" />
                <p className="font-semibold text-base text-foreground">No Credentials Saved</p>
                <p className="text-sm mt-1 max-w-sm">
                  {selectedCategory !== "all"
                    ? "No credentials match selected category filter."
                    : "No passwords stored in this folder yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCredentials.map(c => {
                const catInfo = getCategoryInfo(c.category);
                const CatIcon = catInfo.icon;
                const favUrl = getFaviconUrl(c.url);

                return (
                  <Card key={c.id} className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-muted-foreground/20 bg-card/65 backdrop-blur-sm border border-border/50">
                    <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center overflow-hidden border border-border shrink-0">
                          {favUrl ? (
                            <img
                              src={favUrl}
                              alt="logo"
                              className="h-6 w-6 object-contain"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <CatIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold tracking-tight truncate max-w-[140px]">{c.title}</CardTitle>
                          <CardDescription className="text-xs truncate max-w-[140px] mt-0.5">
                            {c.url ? (
                              <a
                                href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline flex items-center gap-1 text-primary inline-flex cursor-pointer"
                              >
                                {c.url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "No login link"
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      <Badge variant="outline" className={`${catInfo.color} border px-2 py-0.5 font-medium`}>
                        <CatIcon className="h-3 w-3 mr-1" /> {catInfo.label}
                      </Badge>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="space-y-2.5 bg-muted/30 rounded-xl p-3.5 border border-border/40">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium text-xs">Username</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-foreground select-all text-xs max-w-[120px] truncate">
                              {c.username || "—"}
                            </span>
                            {c.username && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 cursor-pointer"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(c.username || "");
                                  toast.success("Username copied!");
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-sm border-t border-border/40 pt-2.5">
                          <span className="text-muted-foreground font-medium text-xs">Password</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-foreground font-semibold text-xs tracking-wider">
                              {visibleMap[c.id] ? decryptedMap[c.id] : "••••••••"}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 cursor-pointer"
                              onClick={() => handleToggleReveal(c.id)}
                            >
                              {visibleMap[c.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 cursor-pointer"
                              onClick={() => handleCopyPassword(c.id)}
                            >
                              {copiedId === c.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Display Custom Fields limit to 2 on card */}
                      {c.custom_fields && c.custom_fields.length > 0 && (
                        <div className="space-y-1.5 bg-accent/15 border border-border/20 rounded-lg p-2 text-xs">
                          {c.custom_fields.slice(0, 2).map((cf, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-muted-foreground font-medium text-[11px] truncate max-w-[100px]">{cf.label}:</span>
                              <div className="flex items-center gap-1 max-w-[160px]">
                                <span className="font-mono text-foreground/80 truncate text-[11px] select-all">{cf.value}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 hover:bg-muted cursor-pointer"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(cf.value);
                                    toast.success(`${cf.label} copied!`);
                                  }}
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {c.custom_fields.length > 2 && (
                            <div className="text-[10px] text-primary/80 text-right font-medium">
                              + {c.custom_fields.length - 2} more fields (Use Quick View)
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {c.permission_level === "edit" ? (
                            <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500/20 text-[10px] py-0.5">
                              <ShieldCheck className="h-3 w-3 mr-0.5" /> Full Access
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px] py-0.5">
                              <Shield className="h-3 w-3 mr-0.5" /> View Only
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2.5 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/5 cursor-pointer mr-auto"
                          onClick={() => {
                            setQuickViewCred(c);
                            setQuickViewOpen(true);
                          }}
                        >
                          <Maximize2 className="h-3.5 w-3.5 mr-1" /> Quick View
                        </Button>
                        {c.permission_level === "edit" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() => openEditSheet(c)}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              onClick={() => handleDelete(c.id, c.title)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Sheet Drawer */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex flex-col h-full p-0 max-w-[500px] sm:max-w-[540px]">
          <div className="py-4 px-6 border-b border-border/40 shrink-0">
            <SheetHeader>
              <SheetTitle>{editingCred ? "Edit Secure Credential" : "Add Secure Credential"}</SheetTitle>
              <SheetDescription>
                {editingCred
                  ? "Update your client credential. Password changes will be re-encrypted automatically."
                  : "Create a new secure credentials card. Passwords will be encrypted via server-side AES-256."}
              </SheetDescription>
            </SheetHeader>
          </div>

          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">Title / Name *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Namecheap Hosting Account"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                          {c.label}
                        </SelectItem>
                      ))}
                      {customCategories.map(c => (
                        <SelectItem key={c} value={c} className="cursor-pointer">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                      <SelectItem value="create_new" className="font-semibold text-primary cursor-pointer border-t border-border mt-1">
                        + Create New Category...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client" className="text-xs">Select Folder *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id="client" className="cursor-pointer">
                      <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients
                        .filter(c => isAdmin || c.permission_level === "edit")
                        .map(c => (
                          <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                            {c.company_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {category === "create_new" && (
                <div className="space-y-1.5 bg-primary/5 p-3 rounded-xl border border-primary/10">
                  <Label htmlFor="newCategory" className="text-xs font-semibold text-primary">New Category Name *</Label>
                  <Input
                    id="newCategory"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="e.g. cloudflare, custom_api, vps"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="url" className="text-xs">Login URL (Optional)</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="e.g. https://www.namecheap.com/signin"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs">Username / Email</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin@cnit.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs">
                  Password {editingCred && "(Leave blank to keep current)"} *
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="pass"
                    type={formPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={editingCred ? "•••••••• (hidden)" : "Type safe password"}
                    required={!editingCred}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setFormPasswordVisible(!formPasswordVisible)}
                  >
                    {formPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">Notes / Details (Optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any special access conditions, OTP backups, etc."
                />
              </div>

              {/* Custom fields form inputs list */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">Custom Fields / Credentials</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] cursor-pointer flex items-center gap-1 px-2"
                    onClick={() => setCustomFields(prev => [...prev, { label: "", value: "" }])}
                  >
                    <Plus className="h-3 w-3" /> Add Field
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
                  Use custom fields to save Port numbers, Database Names, Server IPs, SSH keys etc.
                </p>

                {customFields.length > 0 && (
                  <div className="space-y-2.5">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          value={field.label}
                          onChange={e => {
                            const updated = [...customFields];
                            updated[index].label = e.target.value;
                            setCustomFields(updated);
                          }}
                          placeholder="Label (e.g. Port)"
                          className="h-8.5 text-xs flex-1"
                        />
                        <Input
                          value={field.value}
                          onChange={e => {
                            const updated = [...customFields];
                            updated[index].value = e.target.value;
                            setCustomFields(updated);
                          }}
                          placeholder="Value (e.g. 3306)"
                          className="h-8.5 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8.5 w-8.5 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 cursor-pointer"
                          onClick={() => {
                            setCustomFields(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sharing list selection */}
              {activeStaff.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Share Access with Staff
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                    Select staff members to allow them to view or edit this credential. Super admins automatically have full access.
                  </p>
                  <Card className="p-3 bg-muted/20 border border-border/40 rounded-xl">
                    <ScrollArea className="h-40 pr-2">
                      <div className="space-y-3">
                        {activeStaff.map(staff => {
                          const isChecked = sharing[staff.id]?.selected || false;
                          const level = sharing[staff.id]?.level || "view";

                          return (
                            <div key={staff.id} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`staff-${staff.id}`}
                                  checked={isChecked}
                                  onCheckedChange={checked => handleShareCheck(staff.id, !!checked)}
                                  className="cursor-pointer"
                                />
                                <Label
                                  htmlFor={`staff-${staff.id}`}
                                  className="font-normal cursor-pointer select-none"
                                >
                                  {staff.full_name}
                                </Label>
                              </div>

                              {isChecked && (
                                <Select
                                  value={level}
                                  onValueChange={v => handleShareLevelChange(staff.id, v as any)}
                                >
                                  <SelectTrigger className="h-7 w-28 text-xs cursor-pointer">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="view" className="cursor-pointer">View Only</SelectItem>
                                    <SelectItem value="edit" className="cursor-pointer">Can Edit</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              )}
            </div>

            <div className="py-4 px-6 border-t border-border shrink-0 bg-card/50">
              <SheetFooter className="mt-0">
                <Button type="submit" disabled={formSubmitting} className="w-full sm:w-auto cursor-pointer">
                  {formSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    editingCred ? "Save Changes" : "Save Credential"
                  )}
                </Button>
              </SheetFooter>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Quick View Dialog Modal */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-[500px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          {quickViewCred && (
            <>
              <DialogHeader className="pb-3 border-b border-border/40">
                <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                  <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center overflow-hidden border border-border shrink-0">
                    {getFaviconUrl(quickViewCred.url) ? (
                      <img
                        src={getFaviconUrl(quickViewCred.url) || ""}
                        alt="site logo"
                        className="h-6 w-6 object-contain"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      (getCategoryInfo(quickViewCred.category)).icon({ className: "h-5 w-5 text-muted-foreground" })
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <span>{quickViewCred.title}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Folder: {clientName(quickViewCred.client_id)}
                    </span>
                  </div>
                </DialogTitle>
                <DialogDescription className="hidden">
                  Credential detail card read-only view.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-1">
                {/* Meta details Category Badge */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">Category</span>
                  <Badge variant="outline" className={`${(getCategoryInfo(quickViewCred.category)).color} border px-2 py-0.5 font-medium`}>
                    {(getCategoryInfo(quickViewCred.category)).label}
                  </Badge>
                </div>

                {/* Login URL */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Login Link</span>
                  <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 border border-border/30 text-sm">
                    <span className="truncate text-foreground max-w-[360px]">
                      {quickViewCred.url || "—"}
                    </span>
                    {quickViewCred.url && (
                      <a
                        href={quickViewCred.url.startsWith("http") ? quickViewCred.url : `https://${quickViewCred.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80 flex items-center justify-center p-1.5 hover:bg-muted/80 rounded-lg cursor-pointer transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Username / Email</span>
                  <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 border border-border/30 text-sm">
                    <span className="font-mono text-foreground font-medium select-all truncate max-w-[360px]">
                      {quickViewCred.username || "—"}
                    </span>
                    {quickViewCred.username && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted/80 cursor-pointer"
                        onClick={async () => {
                          await navigator.clipboard.writeText(quickViewCred.username || "");
                          toast.success("Username copied!");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Password</span>
                  <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 border border-border/30 text-sm">
                    <span className="font-mono text-foreground font-semibold tracking-wider">
                      {visibleMap[quickViewCred.id] ? decryptedMap[quickViewCred.id] : "••••••••"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted/80 cursor-pointer"
                        onClick={() => handleToggleReveal(quickViewCred.id)}
                      >
                        {visibleMap[quickViewCred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted/80 cursor-pointer"
                        onClick={() => handleCopyPassword(quickViewCred.id)}
                      >
                        {copiedId === quickViewCred.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Dynamic Custom Fields */}
                {quickViewCred.custom_fields && quickViewCred.custom_fields.length > 0 && (
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    <span className="text-xs text-muted-foreground font-semibold">Additional Details</span>
                    <div className="space-y-2">
                      {quickViewCred.custom_fields.map((cf, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-accent/20 rounded-xl px-3 py-2 border border-border/20 text-xs">
                          <span className="text-muted-foreground font-semibold">{cf.label}</span>
                          <div className="flex items-center gap-1.5 max-w-[280px]">
                            <span className="font-mono text-foreground select-all truncate">{cf.value}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 hover:bg-muted cursor-pointer shrink-0"
                              onClick={async () => {
                                await navigator.clipboard.writeText(cf.value);
                                toast.success(`${cf.label} copied!`);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {quickViewCred.notes && (
                  <div className="space-y-1 border-t border-border/40 pt-3">
                    <span className="text-xs text-muted-foreground font-semibold">Notes / Description</span>
                    <div className="text-xs text-foreground bg-accent/10 border border-border/20 p-3 rounded-xl italic leading-relaxed text-muted-foreground/90">
                      {quickViewCred.notes}
                    </div>
                  </div>
                )}

                {/* Audit details for admin */}
                {isAdmin && (
                  <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-3.5 space-y-1">
                    <div>Created at: {formatDate(quickViewCred.created_at)}</div>
                    <div>Last updated: {formatDate(quickViewCred.updated_at)}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog Modal */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-[420px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" /> Create Custom Folder
            </DialogTitle>
            <DialogDescription>
              Enter a name for the new secure credentials folder.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="folderName" className="text-xs">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="e.g. Social Accounts, Server IPs"
                required
                className="col-span-3"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateFolderOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingFolder} className="cursor-pointer">
                {creatingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Create Folder"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog Modal */}
      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent className="max-w-[420px] bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" /> Rename Folder
            </DialogTitle>
            <DialogDescription>
              Enter a new name for the secure folder.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameFolderSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="renameFolderName" className="text-xs">Folder Name</Label>
              <Input
                id="renameFolderName"
                value={renameFolderName}
                onChange={e => setRenameFolderName(e.target.value)}
                placeholder="Folder Name"
                required
                className="col-span-3"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameFolderOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renamingFolder} className="cursor-pointer">
                {renamingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Rename Folder"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share Folder Dialog Modal */}
      <Dialog open={shareFolderOpen} onOpenChange={setShareFolderOpen}>
        <DialogContent className="max-w-[500px] max-h-[85vh] flex flex-col bg-card/95 border border-border/60 rounded-3xl shadow-xl backdrop-blur-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Share Folder: {shareFolderName}
            </DialogTitle>
            <DialogDescription>
              Grant other staff members access to view or edit this folder and its credentials.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 my-4 border border-border/40 rounded-2xl p-4 bg-muted/20">
            {activeStaff.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                No active staff profiles found to share with.
              </div>
            ) : (
              <div className="space-y-4">
                {activeStaff.map(s => {
                  const sMap = folderSharingMap[s.id] || { selected: false, level: "view" };
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`folder-share-${s.id}`}
                          checked={sMap.selected}
                          onCheckedChange={checked => handleFolderShareCheck(s.id, !!checked)}
                        />
                        <Label htmlFor={`folder-share-${s.id}`} className="text-sm font-medium cursor-pointer">
                          {s.full_name}
                        </Label>
                      </div>

                      {sMap.selected && (
                        <Select
                          value={sMap.level}
                          onValueChange={level => handleFolderShareLevelChange(s.id, level as "view" | "edit")}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view" className="text-xs cursor-pointer">View</SelectItem>
                            <SelectItem value="edit" className="text-xs cursor-pointer">Edit</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareFolderOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleFolderShareSubmit}
              disabled={sharingFolderSubmitting}
              className="cursor-pointer"
            >
              {sharingFolderSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                "Save Sharing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Logs Sheet Drawer */}
      <Sheet open={showLogsSheet} onOpenChange={setShowLogsSheet}>
        <SheetContent className="overflow-y-auto w-full max-w-[640px] sm:max-w-[640px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Decryption Audit Logs
            </SheetTitle>
            <SheetDescription>
              Recent history showing which staff viewed or copied secure passwords.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-xs">Fetching audit trail...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm italic">
                No logs recorded yet.
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Credential</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-medium">{log.staff_name}</TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          <Badge variant="secondary" className="px-1.5 py-0 font-normal">
                            {log.folder_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate font-mono text-foreground/80">{log.credential_title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={log.action === "copy" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}>
                            {log.action === "copy" ? "Copied" : "Viewed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
