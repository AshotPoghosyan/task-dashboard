import { useCallback, useEffect, useState } from 'react';

export const THEME_PREFS = ['system', 'light', 'dark'] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'mrdash.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** "System" follows the OS; an explicit choice always wins. Mirrors the script in index.html. */
export const resolveTheme = (pref: ThemePref, systemDark: boolean): Theme =>
  pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

export function readThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return THEME_PREFS.find((p) => p === raw) ?? 'system';
  } catch {
    return 'system';
  }
}

const systemPrefersDark = () => window.matchMedia?.(DARK_QUERY).matches ?? true;

export function applyTheme(pref: ThemePref): Theme {
  const theme = resolveTheme(pref, systemPrefersDark());
  document.documentElement.dataset.theme = theme;
  return theme;
}

/** The saved preference plus a setter that stores it and re-applies the theme. */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  const update = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
    setPref(next);
  }, []);

  return [pref, update];
}
