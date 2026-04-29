"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const KEY = "codenext-theme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(KEY) as Theme | null;
    return (
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    if (typeof window !== "undefined") localStorage.setItem(KEY, t);
  };

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme,
        toggle: () => setTheme(theme === "light" ? "dark" : "light"),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
