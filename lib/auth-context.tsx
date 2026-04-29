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
  loading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isClient: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
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
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (userId: string) => {
    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, designation, avatar_url, client_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(profileData ?? null);
    setRoles((rolesData ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void loadProfileAndRoles(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    loading,
    isAuthenticated: !!user,
    isStaff: roles.some((r) => STAFF_ROLES.includes(r)),
    isClient: roles.includes("client"),
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
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
