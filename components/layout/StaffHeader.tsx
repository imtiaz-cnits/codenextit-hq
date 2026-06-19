"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Sun, Moon, Menu, ChevronLeft, LogOut, Settings, TrendingUp, Receipt, LifeBuoy } from "lucide-react";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../ui/command";
import { Badge } from "../ui/badge";
import { useTheme } from "../../lib/theme-context";
import { useMock } from "../../lib/mock-store";
import { useAuth } from "../../lib/auth-context";
import { initials } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

// Navigation definition from AppShell
import { STAFF_GROUPS } from "../shell/app-shell";

export function StaffHeader({ serverUser }: { serverUser: any }) {
  const { theme, toggle } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const router = useRouter();
  const { notifications, markAllNotificationsRead, markNotificationRead } = useMock();
  const { profile, signOut } = useAuth();

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setCmdOpen(false);
    router.push(to);
  };

  const allItems = STAFF_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

  const [notifOpen, setNotifOpen] = useState(false);

  // Merged server-side and client-side auth data
  const userProfile = profile || serverUser;
  const name = userProfile?.full_name || userProfile?.email || "User";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-4 w-full">
        <SidebarTrigger className="md:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <SidebarTrigger className="hidden md:flex">
          <ChevronLeft className="h-4 w-4" />
        </SidebarTrigger>

        <button
          onClick={() => setCmdOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 h-9 text-sm text-muted-foreground hover:bg-muted transition-colors sm:max-w-md ml-2 mr-2 sm:mx-4 cursor-pointer"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">
            <span className="hidden xs:inline">Search anything…</span>
            <span className="xs:hidden">Search</span>
          </span>
          <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        <div className="flex-1 hidden sm:block" />

        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="cursor-pointer">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative cursor-pointer">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl shadow-xl border-border">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h4 className="font-semibold text-sm">Notifications</h4>
              {unread > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-auto">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setNotifOpen(false);
                      markNotificationRead(n.id);
                      
                      if (n.link) {
                        router.push(n.link);
                      } else if (n.title.toLowerCase().includes("leave")) {
                        router.push("/leave");
                      } else if (n.title.toLowerCase().includes("clock")) {
                        router.push("/attendance");
                      }
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border p-3 text-left hover:bg-muted/50 transition-colors cursor-pointer",
                      !n.read && "bg-accent/30"
                    )}
                  >
                    <div className={cn(
                      "h-2 w-2 mt-1.5 rounded-full shrink-0",
                      n.type === "warning" && "bg-warning",
                      n.type === "success" && "bg-success",
                      n.type === "error" && "bg-destructive",
                      n.type === "info" && "bg-info",
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-border mx-1" />
        
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md p-1 hover:bg-sidebar-accent transition-colors cursor-pointer">
                <Avatar className="h-8 w-8 shrink-0">
                  {userProfile?.avatar_url && <AvatarImage src={userProfile.avatar_url} className="object-cover" />}
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {allItems.map((item) => (
              <CommandItem key={item.to} onSelect={() => go(item.to)} className="cursor-pointer">
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{item.group}</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go("/leads")} className="cursor-pointer">
              <TrendingUp className="mr-2 h-4 w-4" /> Add new lead
            </CommandItem>
            <CommandItem onSelect={() => go("/finance/invoices")} className="cursor-pointer">
              <Receipt className="mr-2 h-4 w-4" /> Create invoice
            </CommandItem>
            <CommandItem onSelect={() => go("/tickets")} className="cursor-pointer">
              <LifeBuoy className="mr-2 h-4 w-4" /> Open ticket
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
