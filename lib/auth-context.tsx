"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type AppRole = "super_admin" | "project_manager" | "staff" | "client";

export interface AuthProfile {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  avatar_url: string | null;
  client_id: string | null;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  permissions: string[];
  loading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isClient: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  canAccess: (module: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STAFF_ROLES: AppRole[] = ["super_admin", "project_manager", "staff"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (userId: string) => {
    try {
      const [{ data: profileData }, { data: rolesData }, { data: permissionsData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, designation, avatar_url, client_id")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles" as any).select("role").eq("user_id", userId) as any,
        supabase.from("user_permissions" as any).select("module_name").eq("user_id", userId).eq("is_enabled", true) as any,
      ]);
      setProfile(profileData ?? null);
      setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
      setPermissions((permissionsData ?? []).map((p: any) => p.module_name));
    } catch (error) {
      console.error("Error loading profile and roles:", error);
      // Don't throw, just let the app continue with empty roles/profile if needed
      // or handle as appropriate
    }
  };

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("Auth event:", event);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid deadlock
        setTimeout(() => {
          void loadProfileAndRoles(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        // If we get a SIGNED_OUT event but loading is true, we should stop loading
        setLoading(false);
      }
    });

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth initialization error:", error.message);
          // If the refresh token is invalid or not found, we must sign out to clear local storage
          if (error.message.includes("refresh_token_not_found") || 
              error.message.includes("Refresh Token Not Found") ||
              error.message.includes("Invalid Refresh Token")) {
            console.warn("Invalid refresh token detected, signing out...");
            await supabase.auth.signOut();
          }
          setLoading(false);
          return;
        }

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          await loadProfileAndRoles(currentSession.user.id);
        }
      } catch (err) {
        console.error("Unexpected auth error during initialization:", err);
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    permissions,
    loading,
    isAuthenticated: !!user,
    isStaff: roles.some((r) => STAFF_ROLES.includes(r)),
    isClient: roles.includes("client"),
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    canAccess: (module) => {
      if (roles.includes("super_admin")) return true;
      return permissions.includes(module);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (user) await loadProfileAndRoles(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
