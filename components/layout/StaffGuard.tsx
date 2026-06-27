"use client";

import { useAuth } from "../../lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Preloader } from "../ui/preloader";
import { STAFF_GROUPS } from "../shell/app-shell";
import { toast } from "sonner";

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isStaff, isClient, canAccess } = useAuth();
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
      } else if (isStaff) {
        // Enforce URL-level module permission checks dynamically
        const matchingItem = STAFF_GROUPS.flatMap((g) => g.items).find((item) => {
          if (item.to === "/dashboard") return pathname === "/dashboard" || pathname === "/";
          return pathname.startsWith(item.to);
        });

        if (matchingItem?.module && !canAccess(matchingItem.module)) {
          router.push("/dashboard");
          toast.error("Access Denied: You do not have permission to view this resource.");
        }
      }
    }
  }, [loading, minLoading, isAuthenticated, isStaff, isClient, pathname, canAccess, router]);

  if (loading || minLoading || !isAuthenticated || (isClient && !isStaff)) {
    return <Preloader message="Authenticating session..." />;
  }

  // Also check inline to prevent rendering of unauthorized page content during redirect transition
  const matchingItem = STAFF_GROUPS.flatMap((g) => g.items).find((item) => {
    if (item.to === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(item.to);
  });
  if (isStaff && matchingItem?.module && !canAccess(matchingItem.module)) {
    return <Preloader message="Redirecting to Dashboard..." />;
  }

  return <>{children}</>;
}
