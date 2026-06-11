"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../integrations/supabase/client";
import { TableSkeleton } from "../../../components/loading-skeletons";
import { toast } from "sonner";
import { CredentialsTab } from "./credentials-tab";

interface Client {
  id: string;
  company_name: string;
  permission_level?: "view" | "edit";
}

export default function VaultPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchWithAuth(urlStr: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(urlStr, { ...options, headers });
  }

  async function loadClients() {
    try {
      const res = await fetchWithAuth("/api/vault/folders");
      if (!res.ok) throw new Error("Failed to load folders");
      const data = await res.json();
      setClients(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vault</h1>
          <p className="text-muted-foreground mt-1">Secure storage for credentials.</p>
        </div>
        <div className="py-20 flex justify-center">
          <TableSkeleton rows={5} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vault</h1>
        <p className="text-muted-foreground mt-1">Secure storage for credentials.</p>
      </div>
      <CredentialsTab clients={clients} onRefreshClients={loadClients} />
    </div>
  );
}
