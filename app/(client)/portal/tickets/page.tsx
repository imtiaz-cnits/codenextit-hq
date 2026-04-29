"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../../../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Loader2, Plus, Send, MessageSquare } from "lucide-react";
import { supabase } from "../../../../integrations/supabase/client";
import { useAuth } from "../../../../lib/auth-context";
import { formatDate } from "../../../../lib/format";
import { toast } from "sonner";

interface Ticket {
  id: string; subject: string; description: string | null;
  priority: string; status: string; created_at: string;
}
interface Comment { id: string; body: string; created_at: string; author_id: string | null; }

export default function ClientTickets() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const load = async () => {
    if (!profile?.client_id) { setLoading(false); return; }
    const { data } = await supabase.from("tickets").select("*").eq("client_id", profile.client_id).order("created_at", { ascending: false });
    setTickets((data ?? []) as unknown as Ticket[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [profile?.client_id]);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    const { data } = await supabase.from("ticket_comments").select("*").eq("ticket_id", t.id).eq("is_internal", false).order("created_at");
    setComments((data ?? []) as unknown as Comment[]);
    const ids = Array.from(new Set((data ?? []).map((c) => c.author_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setAuthorNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name])));
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: active.id, author_id: user.id, body: reply.trim(), is_internal: false,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply("");
    await openTicket(active);
  };

  const variant = (s: string) =>
    s === "open" ? "secondary" : s === "in_progress" ? "default" : s === "resolved" ? "outline" : "outline";
  const prioColor = (p: string) =>
    p === "critical" ? "bg-destructive text-destructive-foreground" : p === "high" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground";

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!profile?.client_id) {
    return (
      <Card>
        <CardHeader><CardTitle>Support</CardTitle><CardDescription>Your account isn't linked to a client record yet.</CardDescription></CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground mt-1">Open tickets and chat with the CodeNext team.</p>
        </div>
        <NewTicketSheet onCreated={load} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your tickets</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {tickets.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No tickets yet — open one above.</p>
          ) : tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium truncate">{t.subject}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={prioColor(t.priority) + " capitalize"}>{t.priority}</Badge>
                  <Badge variant={variant(t.status) as any} className="capitalize">{t.status.replace("_", " ")}</Badge>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Opened {formatDate(t.created_at)}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.subject}</DialogTitle>
                <div className="flex gap-2 pt-2">
                  <Badge className={prioColor(active.priority) + " capitalize"}>{active.priority}</Badge>
                  <Badge variant={variant(active.status) as any} className="capitalize">{active.status.replace("_", " ")}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">{active.description}</div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No replies yet.</p>}
                  {comments.map((c) => {
                    const isMine = c.author_id === user?.id;
                    return (
                      <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="text-[10px] font-medium opacity-70 mb-1">{isMine ? "You" : (c.author_id ? authorNames[c.author_id] || "CodeNext team" : "System")}</p>
                          <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                          <p className="text-[10px] opacity-60 mt-1">{new Date(c.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" rows={2} />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewTicketSheet({ onCreated }: { onCreated: () => void }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ subject: "", description: "", priority: "normal" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.client_id) return;
    setBusy(true);
    const { error } = await supabase.from("tickets").insert({
      subject: f.subject,
      description: f.description,
      priority: f.priority as "low" | "normal" | "high" | "critical",
      client_id: profile.client_id,
      created_by: user.id,
      status: "open" as const,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket opened");
    setF({ subject: "", description: "", priority: "normal" });
    setOpen(false);
    onCreated();
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New ticket</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Open a support ticket</SheetTitle><SheetDescription>We typically respond within one business day.</SheetDescription></SheetHeader>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="space-y-1.5"><Label className="text-xs">Subject</Label><Input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Priority</Label>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low", "normal", "high", "critical"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea required rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <SheetFooter><Button type="submit" disabled={busy}><MessageSquare className="h-4 w-4 mr-1.5" /> {busy ? "Sending…" : "Open ticket"}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
