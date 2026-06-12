"use client";

import { useAuth } from "../../lib/auth-context";
import { AppShell } from "../../components/shell/app-shell";
import { Preloader } from "../../components/ui/preloader";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    const isPortalDashboard = pathname === "/portal" || pathname === "/";
    const hasSeen = sessionStorage.getItem("cnit_has_seen_client_preloader");

    if (isPortalDashboard && !hasSeen) {
      const timer = setTimeout(() => {
        setMinLoading(false);
        sessionStorage.setItem("cnit_has_seen_client_preloader", "true");
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setMinLoading(false);
    }
  }, [pathname]);

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
