"use client";
import React from 'react';
import { useTheme } from './ThemeProvider';

export function HeaderToggle(){
  const { toggleTheme } = useTheme();
  return (
    <button onClick={() => toggleTheme()} className="btn-jarvis">
      Theme
    </button>
  );
}

export default HeaderToggle;
