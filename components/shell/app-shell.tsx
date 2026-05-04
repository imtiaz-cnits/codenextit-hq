"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, FolderKanban, ListTodo, Server, UserCircle,
  Clock, CalendarDays, Wallet, FileText, Receipt, LifeBuoy, FolderLock,
  Settings, Search, Bell, Moon, Sun, LogOut, Sparkles, ChevronLeft, Menu,
  Briefcase, TrendingUp, FileSpreadsheet, Globe, HardDrive, ArrowDownCircle,
  ArrowUpCircle, PiggyBank, AlertCircle, Banknote,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from "../ui/sidebar";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "../ui/popover";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "../ui/command";
import { Badge } from "../ui/badge";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../lib/auth-context";
import { useMock } from "../../lib/mock-store";
import { initials } from "../../lib/format";
import { cn } from "../../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  module?: string;
}

const STAFF_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Command Center", icon: LayoutDashboard }],
  },
  {
    label: "Sales",
    items: [
      { to: "/leads", label: "Leads Pipeline", icon: TrendingUp, module: "leads" },
      { to: "/clients", label: "Clients", icon: Users, module: "clients" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { to: "/projects", label: "Projects", icon: FolderKanban, module: "projects" },
      { to: "/tasks", label: "My Tasks", icon: ListTodo, module: "tasks" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/team", label: "Team", icon: UserCircle, module: "team" },
      { to: "/attendance", label: "Attendance", icon: Clock, module: "attendance" },
      { to: "/leave", label: "Leave", icon: CalendarDays, module: "leave" },
      { to: "/payroll", label: "Payroll", icon: Wallet, module: "payroll" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/finance/quotes", label: "Quotations", icon: FileText, module: "finance" },
      { to: "/finance/invoices", label: "Invoices", icon: Receipt, module: "finance" },
      { to: "/accounts/income", label: "Income", icon: ArrowDownCircle, module: "accounts" },
      { to: "/accounts/expense", label: "Expense", icon: ArrowUpCircle, module: "accounts" },
      { to: "/accounts/investment", label: "Investment", icon: PiggyBank, module: "accounts" },
      { to: "/accounts/due", label: "Due", icon: AlertCircle, module: "accounts" },
      { to: "/accounts/salary", label: "Salary Sheet", icon: Banknote, module: "accounts" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { to: "/infrastructure/domains", label: "Domain", icon: Globe, module: "infrastructure" },
      { to: "/infrastructure/hosting", label: "Hosting", icon: HardDrive, module: "infrastructure" },
      { to: "/tickets", label: "Tickets", icon: LifeBuoy, module: "tickets" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/vault", label: "File Vault", icon: FolderLock, module: "vault" },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const CLIENT_NAV: NavItem[] = [
  { to: "/portal", label: "My Projects", icon: Briefcase },
  { to: "/portal/invoices", label: "Invoices", icon: Receipt },
  { to: "/portal/tickets", label: "Support", icon: LifeBuoy },
];

export function AppShell({ children, variant }: { children: ReactNode; variant: "staff" | "client" }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar variant={variant} />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar variant={variant} />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ variant }: { variant: "staff" | "client" }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { canAccess } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href={variant === "staff" ? "/dashboard" : "/portal"} className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary shadow-elegant">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">CodeNext IT HQ</span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
                {variant === "client" ? "Client Portal" : "Agency OS"}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {variant === "staff" ? (
          STAFF_GROUPS.map((group) => {
            const visibleItems = group.items.filter(i => !i.module || canAccess(i.module));
            if (visibleItems.length === 0) return null;

            return (
              <SidebarGroup key={group.label}>
                {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => {
                      const isActive =
                        pathname === item.to ||
                        (item.to !== "/dashboard" && pathname.startsWith(item.to));
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                            <Link href={item.to}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })
        ) : (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Portal</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {CLIENT_NAV.map((item) => {
                  const isActive = pathname === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.to}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <UserMenu collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const name = profile?.full_name || profile?.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent transition-colors">
          <Avatar className="h-8 w-8 shrink-0">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} className="object-cover" />}
            <AvatarFallback className="bg-primary/15 text-primary text-xs">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs font-medium truncate w-full text-left">{name}</span>
              <span className="text-[10px] text-sidebar-foreground/60 truncate w-full text-left">
                {profile?.designation || profile?.email}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ variant }: { variant: "staff" | "client" }) {
  const { theme, toggle } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const router = useRouter();
  const { notifications, markAllNotificationsRead, markNotificationRead } = useMock();
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

  const allItems = variant === "staff"
    ? STAFF_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
    : CLIENT_NAV.map((i) => ({ ...i, group: "Portal" }));

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-4">
        <SidebarTrigger className="md:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <SidebarTrigger className="hidden md:flex">
          <ChevronLeft className="h-4 w-4" />
        </SidebarTrigger>

        <button
          onClick={() => setCmdOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors max-w-md"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search anything…</span>
          <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h4 className="font-semibold text-sm">Notifications</h4>
              {unread > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs text-primary hover:underline"
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
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border p-3 text-left hover:bg-muted/50 transition-colors",
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
          <UserMenu collapsed={true} />
        </div>
      </header>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {allItems.map((item) => (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{item.group}</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
          {variant === "staff" && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Quick actions">
                <CommandItem onSelect={() => go("/leads")}>
                  <TrendingUp className="mr-2 h-4 w-4" /> Add new lead
                </CommandItem>
                <CommandItem onSelect={() => go("/finance/invoices")}>
                  <Receipt className="mr-2 h-4 w-4" /> Create invoice
                </CommandItem>
                <CommandItem onSelect={() => go("/tickets")}>
                  <LifeBuoy className="mr-2 h-4 w-4" /> Open ticket
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
