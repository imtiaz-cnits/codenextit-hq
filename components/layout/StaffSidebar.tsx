"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Settings, LogOut } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar } from "../ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useAuth } from "../../lib/auth-context";
import { initials } from "../../lib/format";

// Reuse STAFF_GROUPS navigation definition from AppShell
import { STAFF_GROUPS } from "../shell/app-shell";

export function StaffSidebar({ serverUser }: { serverUser: any }) {
  const pathname = usePathname();
  const { state, setOpenMobile } = useSidebar();
  const { canAccess, profile, signOut } = useAuth();
  const router = useRouter();

  const collapsed = state === "collapsed";

  // Merged server-side and client-side auth data
  const userProfile = profile || serverUser;
  const name = userProfile?.full_name || userProfile?.email || "User";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-2 py-0">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary shadow-elegant">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">CodeNext IT HQ</span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">
                Agency OS
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {STAFF_GROUPS.map((group) => {
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
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} onClick={() => setOpenMobile(false)}>
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
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent transition-colors cursor-pointer">
              <Avatar className="h-8 w-8 shrink-0">
                {userProfile?.avatar_url && <AvatarImage src={userProfile.avatar_url} className="object-cover" />}
                <AvatarFallback className="bg-primary/15 text-primary text-xs">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-xs font-medium truncate w-full text-left">{name}</span>
                  <span className="text-[10px] text-sidebar-foreground/60 truncate w-full text-left">
                    {userProfile?.designation || userProfile?.email}
                  </span>
                </div>
              )}
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
      </SidebarFooter>
    </Sidebar>
  );
}
