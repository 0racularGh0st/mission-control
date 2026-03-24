"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "jarvis-dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "jarvis-dark";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  return savedTheme === "jarvis-dark" ? savedTheme : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme("jarvis-dark"),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
