"use client";

import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "../../../lib/auth-context";
import { useMock } from "../../../lib/mock-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Textarea } from "../../../components/ui/textarea";
import { initials, avatarColor } from "../../../lib/format";
import { Shield, User, Users, Loader2, UserCog, Link as LinkIcon, Palette, Upload, Trash2, Webhook, Copy, RefreshCw, Eye, EyeOff, Globe, HardDrive, LifeBuoy, TrendingUp, FolderKanban, ListTodo, Clock, CalendarDays, Wallet, Receipt, Banknote, FolderLock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../integrations/supabase/client";
import { fetchWorkspaceSettings, invalidateWorkspaceSettings, DEFAULT_SETTINGS, type WorkspaceSettings } from "../../../hooks/use-workspace-settings";
import { cn } from "../../../lib/utils";
import { TableSkeleton, CardGridSkeleton } from "../../../components/loading-skeletons";

const ROLES: AppRole[] = ["super_admin", "project_manager", "staff", "client"];
const MODULES = [
  "leads", "clients", "projects", "tasks", "attendance", "leave", 
  "payroll", "finance", "accounts", "infrastructure", "tickets", "vault"
];

export default function SettingsPage() {
  const { hasRole } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, team and access roles.</p>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" /> Profile</TabsTrigger>
          {hasRole("super_admin") && <TabsTrigger value="users"><UserCog className="h-3.5 w-3.5 mr-1.5" /> Users & Roles</TabsTrigger>}
          {hasRole("super_admin") && <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1.5" /> Branding</TabsTrigger>}
          {hasRole("super_admin") && <TabsTrigger value="integrations"><Webhook className="h-3.5 w-3.5 mr-1.5" /> Integrations</TabsTrigger>}
          <TabsTrigger value="workspace"><Shield className="h-3.5 w-3.5 mr-1.5" /> Workspace</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4"><ProfilePanel /></TabsContent>
        {hasRole("super_admin") && <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>}
        {hasRole("super_admin") && <TabsContent value="branding" className="mt-4"><BrandingPanel /></TabsContent>}
        {hasRole("super_admin") && <TabsContent value="integrations" className="mt-4"><IntegrationsPanel /></TabsContent>}
        <TabsContent value="workspace" className="mt-4"><WorkspacePanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfilePanel() {
  const { profile, roles, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [designation, setDesignation] = useState(profile?.designation || "");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      setUploading(false);
      return toast.error(uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id);

    // Sync to employees table as well
    await supabase.from('employees').update({ avatar_url: publicUrl }).eq('profile_id', profile.id);

    setUploading(false);
    if (updateError) return toast.error(updateError.message);

    toast.success("Profile picture updated");
    await refresh();
  };

  useEffect(() => {
    if (profile) {
      setName(profile.full_name || "");
      setDesignation(profile.designation || "");
      void supabase.from("profiles").select("phone").eq("id", profile.id).maybeSingle().then(({ data }) => {
        if (data?.phone) setPhone(data.phone as string);
      });
      // Fetch employee info
      void supabase.from("employees").select("emergency_contact, notes").eq("profile_id", profile.id).maybeSingle().then(({ data }) => {
        if (data) {
          setEmergencyContact(data.emergency_contact || "");
          setNotes(data.notes || "");
        }
      });
    }
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error: pErr } = await supabase.from("profiles").update({ 
      full_name: name, 
      designation, 
      phone,
      avatar_url: profile.avatar_url // ensure sync
    }).eq("id", profile.id);

    const { error: eErr } = await supabase.from("employees").update({ 
      full_name: name, // assuming it exists
      designation,
      phone,
      emergency_contact: emergencyContact, 
      notes,
      avatar_url: profile.avatar_url // ensure sync
    }).eq("profile_id", profile.id);
    setSaving(false);
    if (pErr || eErr) return toast.error(pErr?.message || eErr?.message);
    toast.success("Profile updated");
    await refresh();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle><CardDescription>How you appear across the workspace.</CardDescription></CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-muted shadow-lg">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} className="object-cover" />}
              <AvatarFallback className={cn("text-2xl text-white", avatarColor(name || "U"))}>
                {initials(name || "U")}
              </AvatarFallback>
            </Avatar>
            <Label className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full cursor-pointer shadow-md hover:scale-110 transition-transform">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input type="file" className="hidden" accept="image/*" onChange={onUpload} disabled={uploading} />
            </Label>
          </div>
          <div className="text-center sm:text-left space-y-1">
            <div className="text-xl font-bold">{name || "Your Name"}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-2">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize bg-primary/10 text-primary border-primary/20">
                  {r.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880…" /></div>
          <div className="space-y-2"><Label>Emergency Contact</Label><Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name / Phone" /></div>
        </div>
        <div className="space-y-2"><Label>Professional Bio / Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tell us about yourself..." rows={4} /></div>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save changes"}</Button>
      </CardContent>
    </Card>
  );
}

interface UserRow {
  id: string; email: string; full_name: string; designation: string | null;
  client_id: string | null; roles: AppRole[]; avatar_url: string | null;
}
interface ClientRow { id: string; company_name: string }
interface UserPermission { module_name: string; is_enabled: boolean }

function UsersPanel() {
  const { removeUser } = useMock();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [active, setActive] = useState<UserRow | null>(null);
  const [permUser, setPermUser] = useState<UserRow | null>(null);
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: rolesData }, { data: cs }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, designation, client_id, avatar_url"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    const map = (profs ?? []).map((p: any) => ({
      ...p,
      roles: (rolesData ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role as AppRole),
    }));
    setUsers(map as UserRow[]);
    setClients(cs as ClientRow[] ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const toggleRole = async (user: UserRow, role: AppRole, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
      if (error) return toast.error(error.message);
    }
    toast.success(`Role ${on ? "added" : "removed"}`);
    await load();
    if (active?.id === user.id) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setActive({ ...active, roles: (data ?? []).map((r: any) => r.role as AppRole) });
    }
  };

  const linkClient = async (user: UserRow, clientId: string | null) => {
    const { error } = await supabase.from("profiles").update({ client_id: clientId }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(clientId ? "Linked to client" : "Unlinked");
    await load();
    if (active?.id === user.id) setActive({ ...active, client_id: clientId });
  };

  const updateDesignation = async (user: UserRow, val: string) => {
    const { error: pErr } = await supabase.from("profiles").update({ designation: val }).eq("id", user.id);
    const { error: eErr } = await supabase.from("employees").update({ designation: val }).eq("profile_id", user.id);
    if (pErr || eErr) return toast.error(pErr?.message || eErr?.message);
    toast.success("Designation updated");
    await load();
    if (active?.id === user.id) setActive({ ...active, designation: val });
  };
  
  const loadPerms = async (user: UserRow) => {
    setPermUser(user);
    const { data } = await (supabase.from("user_permissions" as any) as any).select("module_name").eq("user_id", user.id).eq("is_enabled", true);
    setUserPerms((data || []).map((p: any) => p.module_name));
  };

  const togglePerm = async (module: string, on: boolean) => {
    if (!permUser) return;
    if (on) {
      await (supabase.from("user_permissions" as any) as any).upsert({ user_id: permUser.id, module_name: module, is_enabled: true }, { onConflict: "user_id, module_name" });
      setUserPerms(prev => [...prev, module]);
    } else {
      await (supabase.from("user_permissions" as any) as any).update({ is_enabled: false }).eq("user_id", permUser.id).eq("module_name", module);
      setUserPerms(prev => prev.filter(p => p !== module));
    }
  };

  if (loading) return <TableSkeleton rows={8} cols={5} />;

  const roleColor: Record<AppRole, string> = {
    super_admin: "bg-destructive/15 text-destructive border-destructive/20",
    project_manager: "bg-info/10 text-info border-info/20",
    staff: "bg-primary/10 text-primary border-primary/20",
    client: "bg-success/10 text-success border-success/20",
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users & Roles</CardTitle>
          <CardDescription>Promote staff, link clients to portal accounts. Only super admins see this tab.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Designation</TableHead>
              <TableHead>Roles</TableHead><TableHead>Linked client</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} className="object-cover" />}
                        <AvatarFallback className={avatarColor(u.full_name)}>{initials(u.full_name || u.email)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.designation ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r} variant="outline" className={roleColor[r] + " capitalize text-[10px]"}>{r.replace("_", " ")}</Badge>)}
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{clients.find((c) => c.id === u.client_id)?.company_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadPerms(u)}>
                        <Shield className="h-3 w-3 mr-1.5" /> Permissions
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActive(u)}>Manage</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Manage {active.full_name || active.email}</DialogTitle>
                <DialogDescription>{active.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Roles</Label>
                  <div className="space-y-2 mt-2">
                    {ROLES.map((r) => {
                      const has = active.roles.includes(r);
                      return (
                        <div key={r} className="flex items-center justify-between rounded-md border border-border p-2.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={roleColor[r] + " capitalize"}>{r.replace("_", " ")}</Badge>
                          </div>
                          <Button size="sm" variant={has ? "outline" : "default"} onClick={() => toggleRole(active, r, !has)}>
                            {has ? "Remove" : "Grant"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /> Client portal link</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">If this user is a client, link their account to a company so they only see their own data.</p>
                  <div className="flex gap-2">
                    <Select value={active.client_id ?? "none"} onValueChange={(v) => linkClient(active, v === "none" ? null : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not linked —</SelectItem>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-6 border-t mt-4">
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2 shadow-sm"
                    onClick={async () => {
                      if (!active) return;
                      if (confirm(`Are you sure you want to permanently delete the user account for ${active.full_name || active.email}? This will remove their profile and all assigned roles.`)) {
                        await removeUser(active.id);
                        setActive(null);
                        load(); // refresh list
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete User Account
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center font-medium">
                    This action is permanent and removes all access data for this person.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Permissions Dialog */}
      <Dialog open={!!permUser} onOpenChange={(o) => !o && setPermUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Module Access: {permUser?.full_name || permUser?.email}</DialogTitle>
                <DialogDescription>Control which features are visible in the sidebar for this user.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-6">
            {MODULES.map((m) => {
              const has = userPerms.includes(m);
              const icons: Record<string, any> = {
                leads: TrendingUp, clients: Users, projects: FolderKanban, 
                tasks: ListTodo, attendance: Clock, leave: CalendarDays, 
                payroll: Wallet, finance: Receipt, accounts: Banknote, 
                infrastructure: Globe, tickets: LifeBuoy, vault: FolderLock
              };
              const Icon = icons[m] || Shield;

              return (
                <div 
                  key={m} 
                  className={cn(
                    "flex items-center justify-between p-3.5 border rounded-xl transition-all duration-200",
                    has ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-muted/30 border-transparent hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                      has ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold capitalize">{m}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-tight">Module</div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant={has ? "default" : "outline"}
                    className={cn("h-8 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider", !has && "text-muted-foreground")}
                    onClick={() => togglePerm(m, !has)}
                  >
                    {has ? "Active" : "Hidden"}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/50 rounded-lg border border-dashed border-border">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin-slow" />
            <p className="text-[11px] text-muted-foreground font-medium">Changes take effect after user refreshes their dashboard.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BrandingPanel() {
  const [s, setS] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void fetchWorkspaceSettings().then((data) => { setS(data); setLoading(false); });
  }, []);

  const set = <K extends keyof WorkspaceSettings>(k: K, v: WorkspaceSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("workspace_settings")
      .update({
        company_name: s.company_name,
        tagline: s.tagline,
        address: s.address,
        email: s.email,
        website: s.website,
        phone: s.phone,
        vat_bin: s.vat_bin,
        primary_color: s.primary_color,
        accent_color: s.accent_color,
        footer_note: s.footer_note,
        payment_instructions: s.payment_instructions,
        terms: s.terms,
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    invalidateWorkspaceSettings();
    toast.success("Branding saved — applies to new PDFs immediately");
  };

  const onLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");
    setUploading(true);
    const path = `logo-${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    const { error } = await supabase.from("workspace_settings").update({ logo_url: pub.publicUrl }).eq("id", true);
    setUploading(false);
    if (error) return toast.error(error.message);
    invalidateWorkspaceSettings();
    setS({ ...s, logo_url: pub.publicUrl });
    toast.success("Logo updated");
  };

  const removeLogo = async () => {
    const { error } = await supabase.from("workspace_settings").update({ logo_url: null }).eq("id", true);
    if (error) return toast.error(error.message);
    invalidateWorkspaceSettings();
    setS({ ...s, logo_url: null });
    toast.success("Logo removed");
  };

  if (loading) return <CardGridSkeleton count={2} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding & PDF templates</CardTitle>
        <CardDescription>Logo, colors, and copy that appear on every invoice, quote and receipt PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
              {s.logo_url
                ? <img src={s.logo_url} alt="Logo" className="h-full w-full object-contain" />
                : <Palette className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="flex gap-2">
              <Label className="cursor-pointer">
                <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
                  <span><Upload className="h-3.5 w-3.5 mr-1.5" /> {uploading ? "Uploading…" : "Upload"}</span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
              </Label>
              {s.logo_url && (
                <Button type="button" size="sm" variant="ghost" onClick={removeLogo}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PNG with transparent background works best. Max 2 MB.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Company name</Label><Input value={s.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Tagline</Label><Input value={s.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={s.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={s.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Website</Label><Input value={s.website ?? ""} onChange={(e) => set("website", e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={s.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">VAT / BIN</Label><Input value={s.vat_bin ?? ""} onChange={(e) => set("vat_bin", e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Primary color (header band)</Label>
            <div className="flex gap-2">
              <input type="color" value={s.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="h-9 w-12 rounded border border-border bg-background cursor-pointer" />
              <Input value={s.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Accent color (success/totals)</Label>
            <div className="flex gap-2">
              <input type="color" value={s.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-12 rounded border border-border bg-background cursor-pointer" />
              <Input value={s.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="font-mono" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5"><Label className="text-xs">Footer note</Label><Input value={s.footer_note ?? ""} onChange={(e) => set("footer_note", e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Payment instructions (invoices)</Label><Textarea rows={3} value={s.payment_instructions ?? ""} onChange={(e) => set("payment_instructions", e.target.value)} placeholder="e.g. Bank transfer — A/C 1234567890, City Bank…" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Terms & conditions (quotations)</Label><Textarea rows={3} value={s.terms ?? ""} onChange={(e) => set("terms", e.target.value)} placeholder="e.g. Quote valid for 30 days. 50% advance to start work…" /></div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save branding"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsPanel() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [secret, setSecret] = useState("");
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [rotating, setRotating] = useState(false);

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/tickets` : "/api/public/tickets";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ticket_webhook_settings")
      .select("secret, enabled, rotated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) { setSecret(data.secret); setEnabled(data.enabled); setRotatedAt(data.rotated_at); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const rotate = async () => {
    if (!confirm("Rotate the webhook secret? Existing integrations will stop working until the new secret is configured.")) return;
    setRotating(true);
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    const newSecret = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase
      .from("ticket_webhook_settings")
      .update({ secret: newSecret, rotated_at: new Date().toISOString() })
      .eq("id", true);
    setRotating(false);
    if (error) return toast.error(error.message);
    toast.success("Secret rotated");
    setShowSecret(true);
    void load();
  };

  const toggleEnabled = async (val: boolean) => {
    const { error } = await supabase.from("ticket_webhook_settings").update({ enabled: val }).eq("id", true);
    if (error) return toast.error(error.message);
    setEnabled(val);
    toast.success(val ? "Webhook enabled" : "Webhook disabled");
  };

  if (loading) return <CardGridSkeleton count={1} />;

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: <YOUR_SECRET>" \\
  -d '{
    "subject": "Login broken",
    "description": "Users get 500 on /login",
    "priority": "high",
    "client_email": "ops@example.com",
    "source": "marketing site"
  }'`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Ticket webhook</CardTitle>
        <CardDescription>Let your main website (or any external service) submit support tickets directly into the queue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => copy(webhookUrl, "URL")}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Shared secret</Label>
            {rotatedAt && <span className="text-[10px] text-muted-foreground">Rotated {new Date(rotatedAt).toLocaleString()}</span>}
          </div>
          <div className="flex gap-2">
            <Input readOnly type={showSecret ? "text" : "password"} value={secret} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={() => copy(secret, "Secret")} disabled={!showSecret}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={rotate} disabled={rotating}>
              {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1.5" /> Rotate</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Send this in the <code className="px-1 rounded bg-muted">X-Webhook-Secret</code> header.</p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <div className="text-sm font-medium">Endpoint status</div>
            <div className="text-xs text-muted-foreground">{enabled ? "Accepting incoming tickets" : "Returning 403 to all callers"}</div>
          </div>
          <Button variant={enabled ? "outline" : "default"} onClick={() => toggleEnabled(!enabled)}>
            {enabled ? "Disable" : "Enable"}
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">cURL example</Label>
          <pre className="rounded-md bg-muted p-3 text-[11px] font-mono overflow-x-auto whitespace-pre">{curlExample}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkspacePanel() {
  const [s, setS] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchWorkspaceSettings().then((data) => {
      setS(data);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase
      .from("workspace_settings")
      .update({
        currency_code: (s as any).currency_code,
        vat_rate: (s as any).vat_rate,
        timezone: (s as any).timezone,
      } as any)
      .eq("id", true as any));
    setSaving(false);
    if (error) return toast.error(error.message);
    invalidateWorkspaceSettings();
    toast.success("Workspace preferences saved");
  };

  if (loading) return <CardGridSkeleton count={1} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Agency-wide preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <Select value={s.currency_code} onValueChange={(v) => setS({ ...s, currency_code: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BDT">BDT (৳)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>VAT Rate (%)</Label>
            <Input type="number" value={s.vat_rate} onChange={(e) => setS({ ...s, vat_rate: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Time Zone</Label>
            <Select value={s.timezone} onValueChange={(v) => setS({ ...s, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Dhaka">Asia/Dhaka</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Save Workspace Changes
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Company name, contact info, and PDF appearance are configured in the Branding tab (super admin only).
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
