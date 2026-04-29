import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export interface WorkspaceSettings {
  company_name: string;
  tagline: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  vat_bin: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  footer_note: string | null;
  payment_instructions: string | null;
  terms: string | null;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  company_name: "CodeNext IT",
  tagline: "Software · Cloud · Creative",
  address: "House 23, Road 5, Dhanmondi, Dhaka 1205, Bangladesh",
  email: "info@codenextit.com",
  website: "codenextit.com",
  phone: null,
  vat_bin: null,
  logo_url: null,
  primary_color: "#4F46E5",
  accent_color: "#16A34A",
  footer_note: "Thank you for your business.",
  payment_instructions: null,
  terms: null,
};

let cached: WorkspaceSettings | null = null;
let inflight: Promise<WorkspaceSettings> | null = null;

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    const next: WorkspaceSettings = data
      ? { ...DEFAULT_SETTINGS, ...(data as Partial<WorkspaceSettings>) }
      : DEFAULT_SETTINGS;
    cached = next;
    inflight = null;
    return next;
  })();
  return inflight;
}

export function invalidateWorkspaceSettings() {
  cached = null;
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<WorkspaceSettings>(cached ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) {
      setSettings(cached);
      setLoading(false);
      return;
    }
    let mounted = true;
    void fetchWorkspaceSettings().then((s) => {
      if (mounted) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading, refresh: () => { invalidateWorkspaceSettings(); return fetchWorkspaceSettings().then(setSettings); } };
}
