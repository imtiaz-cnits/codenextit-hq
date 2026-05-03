"use client";

import { useAuth } from "../../lib/auth-context";
import { AppShell } from "../../components/shell/app-shell";
import { Preloader } from "../../components/ui/preloader";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && !minLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, minLoading, isAuthenticated, router]);

  if (loading || minLoading || !isAuthenticated) {
    return <Preloader message="Loading client portal..." />;
  }

  return (
    <AppShell variant="client">
      {children}
    </AppShell>
  );
}
