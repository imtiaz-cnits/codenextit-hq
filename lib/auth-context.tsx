"use client";

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type AppRole = string;

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

const STAFF_ROLES: AppRole[] = ["super_admin", "admin", "project_manager", "staff"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (userId: string) => {
    try {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, designation, avatar_url, client_id")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles" as any).select("role").eq("user_id", userId) as any,
      ]);
      
      setProfile(profileData ?? null);
      const userRoles = (rolesData ?? []).map((r: any) => r.role as string);
      setRoles(userRoles);

      // Fetch role-based permissions
      let rolePerms: string[] = [];
      if (userRoles.length > 0) {
        const { data: rolePermissionsData } = await supabase
          .from("role_permissions" as any)
          .select("module_name")
          .in("role", userRoles)
          .eq("is_enabled", true);
        rolePerms = (rolePermissionsData ?? []).map((p: any) => p.module_name);
      }

      // Fetch user-specific overrides from user_permissions
      const { data: userPermissionsData } = await supabase
        .from("user_permissions" as any)
        .select("module_name")
        .eq("user_id", userId)
        .eq("is_enabled", true);
      const userPerms = (userPermissionsData ?? []).map((p: any) => p.module_name);

      // Combine both lists (union of role-based and user-specific permissions)
      const combinedPermissions = Array.from(new Set([...rolePerms, ...userPerms]));
      setPermissions(combinedPermissions);
    } catch (error) {
      console.error("Error loading profile and roles:", error);
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
          // If the refresh token is invalid or not found, we must sign out and clear local storage
          if (error.message.includes("refresh_token_not_found") || 
              error.message.includes("Refresh Token Not Found") ||
              error.message.includes("Invalid Refresh Token") ||
              error.message.includes("invalid_grant")) {
            console.warn("Invalid refresh token detected, clearing local storage...");
            if (typeof window !== 'undefined') {
              const keysToRemove: string[] = [];
              for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && (key.includes('auth-token') || key.includes('supabase.auth.token'))) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(k => window.localStorage.removeItem(k));
            }
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn("Error during signOut call:", signOutErr);
            }
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

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    roles,
    permissions,
    loading,
    isAuthenticated: !!user,
    isStaff: roles.length > 0 && roles.some((r) => r !== "client"),
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
  }), [user, session, profile, roles, permissions, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
