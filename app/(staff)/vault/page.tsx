"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { useAuth } from "../../../lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { FileText, Image as ImageIcon, FileCode, Palette, File as FileIcon, Upload, Search, Download, Loader2, Trash2, FolderOpen } from "lucide-react";
import { formatDate } from "../../../lib/format";
import { toast } from "sonner";

type VaultType = "logo" | "srs" | "api_doc" | "design" | "other";
interface VaultRow {
  id: string; name: string; type: VaultType;
  client_id: string | null; project_id: string | null;
  storage_path: string | null; size_bytes: number;
  mime_type: string | null; uploaded_by: string | null;
  created_at: string;
}
interface Client { id: string; company_name: string }
interface Project { id: string; name: string; client_id: string | null }
interface Profile { id: string; full_name: string }

const TYPE_ICON: Record<VaultType, typeof FileText> = {
  logo: ImageIcon, srs: FileText, api_doc: FileCode, design: Palette, other: FileIcon,
};
const TYPE_LABEL: Record<VaultType, string> = {
  logo: "Logo / Brand", srs: "SRS / Spec", api_doc: "API doc", design: "Design", other: "Other",
};

const ALLOWED_MIME = /^(application\/pdf|image\/|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed|application\/octet-stream|text\/|application\/json|application\/x-yaml)/;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function VaultPage() {
  const { profile } = useAuth();
  const [files, setFiles] = useState<VaultRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploaders, setUploaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | VaultType>("all");
  const [folder, setFolder] = useState<"all" | string>("all");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [{ data: f, error }, { data: c }, { data: p }, { data: ps }] = await Promise.all([
      supabase.from("vault_files").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("projects").select("id, name, client_id"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (error) toast.error(error.message);
    setFiles((f ?? []) as VaultRow[]);
    setClients((c ?? []) as Client[]);
    setProjects((p ?? []) as Project[]);
    setUploaders((ps ?? []) as Profile[]);
    setLoading(false);
  }

  const withVersion = useMemo(() => {
    const groups: Record<string, VaultRow[]> = {};
    for (const f of files) {
      const key = `${f.name}|${f.client_id ?? ""}|${f.project_id ?? ""}`;
      (groups[key] ??= []).push(f);
    }
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    );
    const out: Record<string, number> = {};
    Object.values(groups).forEach((arr) => arr.forEach((f, i) => { out[f.id] = i + 1; }));
    return out;
  }, [files]);

  const filtered = files.filter((f) => {
    const matchQ = !q || f.name.toLowerCase().includes(q.toLowerCase());
    const matchT = type === "all" || f.type === type;
    const matchF = folder === "all"
      || (folder === "internal" && !f.client_id)
      || f.client_id === folder;
    return matchQ && matchT && matchF;
  });

  const folderCounts = useMemo(() => {
    const m: Record<string, number> = { all: files.length, internal: files.filter((f) => !f.client_id).length };
    files.forEach((f) => { if (f.client_id) m[f.client_id] = (m[f.client_id] ?? 0) + 1; });
    return m;
  }, [files]);

  const totalBytes = files.reduce((s, f) => s + Number(f.size_bytes), 0);
  const clientName = (id: string | null) => id ? (clients.find((c) => c.id === id)?.company_name ?? "—") : "Internal";
  const projectName = (id: string | null) => id ? (projects.find((p) => p.id === id)?.name ?? "—") : "—";
  const uploaderName = (id: string | null) => id ? (uploaders.find((u) => u.id === id)?.full_name ?? "—") : "—";

  async function downloadFile(f: VaultRow) {
    if (!f.storage_path) return toast.error("No file attached");
    const { data, error } = await supabase.storage.from("vault").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed to sign URL");
    window.open(data.signedUrl, "_blank");
  }

  async function deleteFile(f: VaultRow) {
    if (!confirm(`Delete "${f.name}"? This removes both the file and its record.`)) return;
    if (f.storage_path) await supabase.storage.from("vault").remove([f.storage_path]);
    const { error } = await supabase.from("vault_files").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("File deleted");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Vault</h1>
          <p className="text-muted-foreground mt-1">Secure storage for brand assets, specs, designs and deliverables — with version history.</p>
        </div>
        <UploadSheet clients={clients} projects={projects} userId={profile?.id ?? null} onDone={load} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Files</p>
          <p className="text-2xl font-bold mt-1">{files.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total size</p>
          <p className="text-2xl font-bold mt-1">{fmtSize(totalBytes)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Clients</p>
          <p className="text-2xl font-bold mt-1">{new Set(files.map((f) => f.client_id).filter(Boolean)).size}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Versions tracked</p>
          <p className="text-2xl font-bold mt-1">{Math.max(0, ...Object.values(withVersion))}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Folders</CardTitle></CardHeader>
          <CardContent className="p-2">
            <FolderItem label="All files" count={folderCounts.all ?? 0} active={folder === "all"} onClick={() => setFolder("all")} />
            <FolderItem label="Internal" count={folderCounts.internal ?? 0} active={folder === "internal"} onClick={() => setFolder("internal")} />
            <div className="mt-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground">Clients</div>
            {clients.map((c) => (
              <FolderItem key={c.id} label={c.company_name} count={folderCounts[c.id] ?? 0} active={folder === c.id} onClick={() => setFolder(c.id)} />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="pl-9" />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Files</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>File</TableHead><TableHead>Type</TableHead>
                    <TableHead>Folder</TableHead><TableHead>Project</TableHead>
                    <TableHead>Version</TableHead><TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        No files match your filters.
                      </TableCell></TableRow>
                    ) : filtered.map((f) => {
                      const Icon = TYPE_ICON[f.type] || FileIcon;
                      const v = withVersion[f.id] ?? 1;
                      return (
                        <TableRow key={f.id}>
                          <TableCell><div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate">{f.name}</span>
                          </div></TableCell>
                          <TableCell><Badge variant="outline">{TYPE_LABEL[f.type]}</Badge></TableCell>
                          <TableCell className="text-sm">{clientName(f.client_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{projectName(f.project_id)}</TableCell>
                          <TableCell>
                            <Badge variant={v > 1 ? "default" : "secondary"} className="font-mono text-[10px]">V{v}</Badge>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{fmtSize(Number(f.size_bytes))}</TableCell>
                          <TableCell className="text-sm">
                            <div>{formatDate(f.created_at)}</div>
                            <div className="text-xs text-muted-foreground">{uploaderName(f.uploaded_by)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(f)} disabled={!f.storage_path}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteFile(f)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FolderItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

function UploadSheet({ clients, projects, userId, onDone }: {
  clients: Client[]; projects: Project[]; userId: string | null; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<VaultType>("other");
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [customName, setCustomName] = useState("");

  const eligibleProjects = clientId ? projects.filter((p) => p.client_id === clientId) : projects;

  function reset() {
    setFile(null); setType("other"); setClientId(""); setProjectId(""); setCustomName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a file first");
    if (file.size > MAX_BYTES) return toast.error("File exceeds 50 MB limit");
    setSubmitting(true);
    const finalName = customName.trim() || file.name;
    const folder = clientId || "internal";
    const safe = finalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage.from("vault").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) { setSubmitting(false); return toast.error(upErr.message); }

    const { error: insErr } = await supabase.from("vault_files").insert({
      name: finalName,
      type,
      client_id: clientId || null,
      project_id: projectId || null,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || null,
      uploaded_by: userId,
    });
    setSubmitting(false);
    if (insErr) {
      await supabase.storage.from("vault").remove([path]);
      return toast.error(insErr.message);
    }
    toast.success("File uploaded");
    reset();
    setOpen(false);
    onDone();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <SheetTrigger asChild><Button><Upload className="h-4 w-4 mr-1.5" /> Upload file</Button></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload to vault</SheetTitle>
          <SheetDescription>PDF, images, ZIP, designs — up to 50 MB. Re-uploading the same name auto-bumps the version.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label className="text-xs">File</Label>
            <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} · {fmtSize(file.size)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Display name (optional)</Label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={file?.name ?? "Use original filename"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as VaultType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client folder</Label>
              <Select value={clientId || "internal"} onValueChange={(v) => { setClientId(v === "internal" ? "" : v); setProjectId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Project (optional)</Label>
            <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not linked —</SelectItem>
                {eligibleProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" /> Upload</>}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
