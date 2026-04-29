"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "../lib/theme-context";
import { AuthProvider } from "../lib/auth-context";
import { MockProvider } from "../lib/mock-store";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "./ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MockProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </MockProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
