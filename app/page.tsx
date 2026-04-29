"use client";

import { useAuth } from "../lib/auth-context";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { loading, isAuthenticated, isStaff, isClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (isStaff) {
        router.push("/dashboard");
      } else if (isClient) {
        router.push("/portal");
      } else {
        router.push("/dashboard");
      }
    }
  }, [loading, isAuthenticated, isStaff, isClient, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
