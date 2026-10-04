import { act, renderHook } from '@testing-library/react';
import { readThemePref, resolveTheme, THEME_KEY, useThemePref } from './theme';

function mockSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => media);
  return (next: boolean) => {
    dark = next;
    listeners.forEach((l) => l());
  };
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => vi.unstubAllGlobals());

describe('resolveTheme', () => {
  it('follows the system for "system" and ignores it otherwise', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readThemePref', () => {
  it('defaults to system and ignores junk', () => {
    expect(readThemePref()).toBe('system');
    localStorage.setItem(THEME_KEY, 'purple');
    expect(readThemePref()).toBe('system');
    localStorage.setItem(THEME_KEY, 'light');
    expect(readThemePref()).toBe('light');
  });
});

describe('useThemePref', () => {
  it('applies the system theme by default and follows OS changes', () => {
    const setSystemDark = mockSystem(true);
    renderHook(() => useThemePref());
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => setSystemDark(false));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('stores an explicit choice and stops following the system', () => {
    const setSystemDark = mockSystem(true);
    const { result } = renderHook(() => useThemePref());
    act(() => result.current[1]('light'));
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => setSystemDark(true));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(result.current[0]).toBe('light');
  });

  it('starts from the saved choice', () => {
    mockSystem(false);
    localStorage.setItem(THEME_KEY, 'dark');
    const { result } = renderHook(() => useThemePref());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('index.html pre-paint script', () => {
  it('uses the same storage key and resolution rule as the app', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toContain(`'${THEME_KEY}'`);

    const run = (pref: string | null, systemDark: boolean) => {
      localStorage.clear();
      if (pref) localStorage.setItem(THEME_KEY, pref);
      mockSystem(systemDark);
      delete document.documentElement.dataset.theme;
      new Function(script!)();
      return document.documentElement.dataset.theme;
    };
    for (const pref of [null, 'system', 'light', 'dark'] as const) {
      for (const dark of [true, false]) {
        const expected = resolveTheme(pref === 'light' || pref === 'dark' ? pref : 'system', dark);
        expect(run(pref, dark)).toBe(expected);
      }
    }
  });
});
