import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useLayoutEffect,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { getWebApp } from "../core";
import type { TgThemeParams, TgWebApp } from "../types/webapp";

export type ThemeType = "full" | "minimal" | "custom";

export interface ThemeColors {
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  popover?: string;
  popoverForeground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  sidebar?: string;
  sidebarForeground?: string;
  sidebarPrimary?: string;
  sidebarPrimaryForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarBorder?: string;
  sidebarRing?: string;
}

export interface ThemeCSSVariables {
  [key: string]: string;
}

export interface ThemeProviderOptions {
  storageKey?: string;
  persistPreference?: boolean;
  defaultColors?: ThemeColors;
  customVariables?: ThemeCSSVariables;
  mapThemeParams?: (params: TgThemeParams) => ThemeColors;
  debug?: boolean;
}

interface ThemeContextValue {
  themeType: ThemeType;
  setThemeType: (type: ThemeType) => void;
  colors: ThemeColors;
  isReady: boolean;
  customVariables: ThemeCSSVariables;
}

const DEFAULT_STORAGE_KEY = 'tg-kit-theme';
const DEFAULT_THEME: ThemeType = 'minimal';

const DEFAULT_COLORS: ThemeColors = {
  background: '#0f0f0f',
  foreground: '#f5f5f5',
  card: '#101010',
  cardForeground: '#f5f5f5',
  popover: '#101010',
  popoverForeground: '#f5f5f5',
  primary: '#f5f5f5',
  primaryForeground: '#262626',
  secondary: '#ffffff0a',
  secondaryForeground: '#f5f5f5',
  muted: '#ffffff0a',
  mutedForeground: '#7a7a7a',
  accent: '#ffffff0a',
  accentForeground: '#f5f5f5',
  border: '#ffffff14',
  input: '#ffffff14',
  ring: '#737373',
  sidebar: '#0c0c0c',
  sidebarForeground: '#9e9e9e',
  sidebarPrimary: '#f5f5f5',
  sidebarPrimaryForeground: '#262626',
  sidebarAccent: '#ffffff0a',
  sidebarAccentForeground: '#f5f5f5',
  sidebarBorder: '#ffffff0d',
  sidebarRing: '#a3a3a3',
};

const STANDARD_CSS_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

function getSavedTheme(storageKey: string): ThemeType {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "full" || saved === "minimal" || saved === "custom") return saved;
  } catch {}
  return DEFAULT_THEME;
}

function saveTheme(storageKey: string, theme: ThemeType): void {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {}
}

function applyColorsToCSS(colors: ThemeColors, customVars: ThemeCSSVariables = {}): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;

  const colorMap: Record<keyof ThemeColors, string> = {
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    cardForeground: '--card-foreground',
    popover: '--popover',
    popoverForeground: '--popover-foreground',
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    secondary: '--secondary',
    secondaryForeground: '--secondary-foreground',
    muted: '--muted',
    mutedForeground: '--muted-foreground',
    accent: '--accent',
    accentForeground: '--accent-foreground',
    border: '--border',
    input: '--input',
    ring: '--ring',
    sidebar: '--sidebar',
    sidebarForeground: '--sidebar-foreground',
    sidebarPrimary: '--sidebar-primary',
    sidebarPrimaryForeground: '--sidebar-primary-foreground',
    sidebarAccent: '--sidebar-accent',
    sidebarAccentForeground: '--sidebar-accent-foreground',
    sidebarBorder: '--sidebar-border',
    sidebarRing: '--sidebar-ring',
  };

  Object.entries(colorMap).forEach(([key, cssVar]) => {
    const value = colors[key as keyof ThemeColors];
    if (value !== undefined) {
      root.setProperty(cssVar, value);
    }
  });

  Object.entries(customVars).forEach(([key, value]) => {
    if (value !== undefined) {
      root.setProperty(key, value);
    }
  });
}

function removeAllThemeVars(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;

  STANDARD_CSS_VARS.forEach((cssVar) => {
    root.removeProperty(cssVar);
  });
}

function getThemeColorsFromWebApp(
  wa: TgWebApp | null | undefined,
  defaultColors: ThemeColors,
  mapThemeParams?: (params: TgThemeParams) => ThemeColors
): ThemeColors {
  if (!wa?.themeParams) return defaultColors;

  if (mapThemeParams) {
    return mapThemeParams(wa.themeParams);
  }

  const tp = wa.themeParams;
  return {
    background: tp.bg_color || defaultColors.background,
    foreground: tp.text_color || defaultColors.foreground,
    card: tp.secondary_bg_color || defaultColors.card,
    cardForeground: tp.text_color || defaultColors.cardForeground,
    popover: tp.secondary_bg_color || defaultColors.popover,
    popoverForeground: tp.text_color || defaultColors.popoverForeground,
    primary: tp.button_color || defaultColors.primary,
    primaryForeground: tp.button_text_color || defaultColors.primaryForeground,
    secondary: tp.secondary_bg_color || defaultColors.secondary,
    secondaryForeground: tp.text_color || defaultColors.secondaryForeground,
    muted: tp.secondary_bg_color || defaultColors.muted,
    mutedForeground: tp.hint_color || defaultColors.mutedForeground,
    accent: tp.secondary_bg_color || defaultColors.accent,
    accentForeground: tp.text_color || defaultColors.accentForeground,
    border: tp.section_separator_color || defaultColors.border,
    input: tp.section_separator_color || defaultColors.input,
    ring: tp.hint_color || defaultColors.ring,
    sidebar: tp.secondary_bg_color || defaultColors.sidebar,
    sidebarForeground: tp.hint_color || defaultColors.sidebarForeground,
    sidebarPrimary: tp.button_color || defaultColors.sidebarPrimary,
    sidebarPrimaryForeground: tp.button_text_color || defaultColors.sidebarPrimaryForeground,
    sidebarAccent: tp.secondary_bg_color || defaultColors.sidebarAccent,
    sidebarAccentForeground: tp.text_color || defaultColors.sidebarAccentForeground,
    sidebarBorder: tp.section_separator_color || defaultColors.sidebarBorder,
    sidebarRing: tp.hint_color || defaultColors.sidebarRing,
  };
}

function updateTelegramAppColors(wa: TgWebApp | null | undefined, colors: ThemeColors): void {
  if (!wa) return;

  const bgColor = colors.background || '#0f0f0f';

  try {
    wa.setHeaderColor(bgColor);
    wa.setBackgroundColor(bgColor);
    if (wa.setBottomBarColor) {
      wa.setBottomBarColor(bgColor);
    }
  } catch (error) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn('Failed to update Telegram app colors:', error);
    }
  }
}

export function ThemeProvider({
  children,
  options = {},
}: {
  children: ReactNode;
  options?: ThemeProviderOptions;
}) {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    persistPreference = true,
    defaultColors = DEFAULT_COLORS,
    customVariables = {},
    mapThemeParams,
    debug = false,
  } = options;

  const [themeType, setThemeTypeState] = useState<ThemeType>(DEFAULT_THEME);
  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[ThemeProvider]', ...args);
    }
  }, [debug]);

  const setThemeType = useCallback((type: ThemeType) => {
    if (persistPreference) {
      saveTheme(storageKey, type);
    }
    setThemeTypeState(type);

    const wa = getWebApp();
    let newColors: ThemeColors;

    if (type === 'minimal') {
      newColors = defaultColors;
      removeAllThemeVars();
      if (Object.keys(customVariables).length > 0) {
        applyColorsToCSS(defaultColors, customVariables);
      }
    } else if (type === 'full') {
      newColors = getThemeColorsFromWebApp(wa, defaultColors, mapThemeParams);
      applyColorsToCSS(newColors, customVariables);
    } else {
      newColors = defaultColors;
      applyColorsToCSS(defaultColors, customVariables);
    }

    setColors(newColors);
    updateTelegramAppColors(wa, newColors);
    log('Theme applied:', type, newColors);
  }, [storageKey, persistPreference, defaultColors, customVariables, mapThemeParams, log]);

  useLayoutEffect(() => {
    const savedTheme = persistPreference ? getSavedTheme(storageKey) : DEFAULT_THEME;
    setThemeTypeState(savedTheme);
    setIsReady(true);

    const wa = getWebApp();
    let initialColors: ThemeColors;

    if (savedTheme === 'minimal') {
      initialColors = defaultColors;
      removeAllThemeVars();
      if (Object.keys(customVariables).length > 0) {
        applyColorsToCSS(defaultColors, customVariables);
      }
    } else if (savedTheme === 'full') {
      initialColors = getThemeColorsFromWebApp(wa, defaultColors, mapThemeParams);
      applyColorsToCSS(initialColors, customVariables);
    } else {
      initialColors = defaultColors;
      applyColorsToCSS(defaultColors, customVariables);
    }

    setColors(initialColors);
    updateTelegramAppColors(wa, initialColors);
    log('Initial theme applied:', savedTheme, initialColors);

    const handleThemeChanged = () => {
      const currentTheme = getSavedTheme(storageKey);

      if (currentTheme === 'full') {
        const newColors = getThemeColorsFromWebApp(wa, defaultColors, mapThemeParams);
        setColors(newColors);
        applyColorsToCSS(newColors, customVariables);
        updateTelegramAppColors(wa, newColors);
        log('Theme updated from Telegram:', newColors);
      } else if (currentTheme === 'minimal') {
        removeAllThemeVars();
        if (Object.keys(customVariables).length > 0) {
          applyColorsToCSS(defaultColors, customVariables);
        }
        updateTelegramAppColors(wa, defaultColors);
      }
    };

    if (wa) {
      wa.onEvent('themeChanged', handleThemeChanged);
    }

    initializedRef.current = true;

    return () => {
      if (wa) {
        wa.offEvent('themeChanged', handleThemeChanged);
      }
    };
  }, [storageKey, persistPreference, defaultColors, customVariables, mapThemeParams, log]);

  if (!isReady) {
    return children as React.ReactElement;
  }

  return (
    <ThemeContext.Provider
      value={{
        themeType,
        setThemeType,
        colors,
        isReady,
        customVariables,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeColors() {
  const context = useTheme();
  return context.colors;
}

export function applyThemeManually(
  themeType: ThemeType,
  colors: ThemeColors,
  customVars?: ThemeCSSVariables
): void {
  if (typeof document === 'undefined') return;

  if (themeType === 'minimal') {
    removeAllThemeVars();
    if (customVars && Object.keys(customVars).length > 0) {
      applyColorsToCSS(colors, customVars);
    }
  } else {
    applyColorsToCSS(colors, customVars || {});
  }
}
