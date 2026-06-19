"use client";

import { useAuth } from "../../lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Preloader } from "../ui/preloader";

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isStaff, isClient } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    const isDashboard = pathname === "/dashboard" || pathname === "/";
    const hasSeen = sessionStorage.getItem("cnit_has_seen_preloader");

    if (isDashboard && !hasSeen) {
      const timer = setTimeout(() => {
        setMinLoading(false);
        sessionStorage.setItem("cnit_has_seen_preloader", "true");
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setMinLoading(false);
    }
  }, [pathname]);

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

  return <>{children}</>;
}
