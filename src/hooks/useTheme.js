import { useCallback, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'weatherThemeMode';
const THEME_MODES = ['system', 'dark', 'light'];

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_MODES.includes(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable
  }
  return 'system';
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState(readStoredThemeMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const resolvedTheme = useMemo(
    () => (themeMode === 'system' ? systemTheme : themeMode),
    [themeMode, systemTheme]
  );

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Storage unavailable
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-mode', themeMode);
  }, [resolvedTheme, themeMode]);

  const cycleThemeMode = useCallback(() => {
    setThemeMode((currentMode) => {
      const index = THEME_MODES.indexOf(currentMode);
      const nextIndex = (index + 1) % THEME_MODES.length;
      return THEME_MODES[nextIndex];
    });
  }, []);

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    cycleThemeMode,
  };
}
