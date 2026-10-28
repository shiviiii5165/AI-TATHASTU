"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "ai-tathastu-theme";
const THEME_CHANGE_EVENT = "ai-tathastu-theme-change";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (item === "light" || item === "dark" || item === "system") {
      return item;
    }
  } catch {
    // Graceful fallback when localStorage is blocked/unavailable
  }
  return "system";
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize from storage / system on mount
  useEffect(() => {
    const initialTheme = getStoredTheme();
    const initialSystem = getSystemTheme();
    setThemeState(initialTheme);
    setSystemTheme(initialSystem);
    setMounted(true);

    const initialResolved = initialTheme === "system" ? initialSystem : initialTheme;
    applyThemeToDOM(initialResolved);
  }, []);

  // Compute resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (!mounted) {
      // Before mount, check if .dark is already on the document root (set by head script)
      if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
        return "dark";
      }
      return "light";
    }
    return theme === "system" ? systemTheme : theme;
  }, [mounted, theme, systemTheme]);

  // Apply theme to DOM and dispatch event whenever resolvedTheme changes after mount
  useEffect(() => {
    if (!mounted) return;
    applyThemeToDOM(resolvedTheme);
  }, [mounted, resolvedTheme]);

  // Setter function
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage unavailable
    }

    const nextResolved = newTheme === "system" ? getSystemTheme() : newTheme;
    applyThemeToDOM(nextResolved);

    // Notify non-React vanilla scripts (e.g. landing.js)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, {
          detail: { theme: newTheme, resolvedTheme: nextResolved },
        })
      );
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  // Listen to system prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const nextSys: ResolvedTheme = e.matches ? "dark" : "light";
      setSystemTheme(nextSys);
      if (theme === "system") {
        applyThemeToDOM(nextSys);
        window.dispatchEvent(
          new CustomEvent(THEME_CHANGE_EVENT, {
            detail: { theme: "system", resolvedTheme: nextSys },
          })
        );
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [theme]);

  // Listen to cross-tab storage changes and custom events from vanilla scripts
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const val = e.newValue;
        if (val === "light" || val === "dark" || val === "system") {
          setThemeState(val);
          const nextResolved = val === "system" ? getSystemTheme() : val;
          applyThemeToDOM(nextResolved);
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail && customEvent.detail.theme) {
        const val = customEvent.detail.theme;
        if (val !== theme && (val === "light" || val === "dark" || val === "system")) {
          setThemeState(val);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    };
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
