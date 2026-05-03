"use client";

import { useAuth } from "../../lib/auth-context";
import { AppShell } from "../../components/shell/app-shell";
import { Preloader } from "../../components/ui/preloader";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isStaff, isClient } = useAuth();
  const router = useRouter();

  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && !minLoading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (isClient && !isStaff) {
        router.push("/portal");
      }
    }
  }, [loading, minLoading, isAuthenticated, isStaff, isClient, router]);

  if (loading || minLoading || !isAuthenticated || (isClient && !isStaff)) {
    return <Preloader message="Authenticating session..." />;
  }

  return (
    <AppShell variant="staff">
      {children}
    </AppShell>
  );
}
