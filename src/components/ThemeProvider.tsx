"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import '../../app/styles/tokens.css';

type Theme = 'jarvis-dark' | string;

const ThemeContext = createContext({ theme: 'jarvis-dark' as Theme, setTheme: (t: Theme) => {}, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }){
  const STORAGE_KEY = 'theme';
  const defaultTheme: Theme = 'jarvis-dark';
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  useEffect(() => {
    try{
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if(saved) setThemeState(saved);
    }catch{}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try{ localStorage.setItem(STORAGE_KEY, theme); }catch{}
  }, [theme]);

  function setTheme(t: Theme){ setThemeState(t); }
  function toggleTheme(){ setThemeState((cur) => (cur === 'jarvis-dark' ? 'jarvis-dark' : 'jarvis-dark')); }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(){ return useContext(ThemeContext); }
