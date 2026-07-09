import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { getWebApp } from '../core';
import type { SafeAreaInset } from '../types';

interface FullscreenContextValue {
  isFullscreen: boolean;
  isSupported: boolean;
  isActive: boolean;
  isOrientationLocked: boolean;
  safeArea: SafeAreaInset;
  contentSafeArea: SafeAreaInset;
  lastError: { error: 'UNSUPPORTED' | 'ALREADY_FULLSCREEN' } | null;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
}

export interface FullscreenProviderOptions {
  storageKey?: string;
  persistPreference?: boolean;
}

const ZERO_INSET: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

const SAFE_AREA_VARS = {
  top: '--tg-safe-area-inset-top',
  bottom: '--tg-safe-area-inset-bottom',
  left: '--tg-safe-area-inset-left',
  right: '--tg-safe-area-inset-right',
} as const;

const CONTENT_SAFE_AREA_VARS = {
  top: '--tg-content-safe-area-inset-top',
  bottom: '--tg-content-safe-area-inset-bottom',
  left: '--tg-content-safe-area-inset-left',
  right: '--tg-content-safe-area-inset-right',
} as const;

function applySafeAreaVars(inset: SafeAreaInset) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  
  root.setProperty(SAFE_AREA_VARS.top, `${inset.top}px`);
  root.setProperty(SAFE_AREA_VARS.bottom, `${inset.bottom}px`);
  root.setProperty(SAFE_AREA_VARS.left, `${inset.left}px`);
  root.setProperty(SAFE_AREA_VARS.right, `${inset.right}px`);
}

function applyContentSafeAreaVars(inset: SafeAreaInset) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  
  root.setProperty(CONTENT_SAFE_AREA_VARS.top, `${inset.top}px`);
  root.setProperty(CONTENT_SAFE_AREA_VARS.bottom, `${inset.bottom}px`);
  root.setProperty(CONTENT_SAFE_AREA_VARS.left, `${inset.left}px`);
  root.setProperty(CONTENT_SAFE_AREA_VARS.right, `${inset.right}px`);
}

const FullscreenContext = createContext<FullscreenContextValue | null>(null);

export function useFullscreen(): FullscreenContextValue {
  const ctx = useContext(FullscreenContext);
  if (!ctx) throw new Error('useFullscreen must be used within FullscreenProvider');
  return ctx;
}

export function FullscreenProvider({
  children,
  options = {},
}: {
  children: ReactNode;
  options?: FullscreenProviderOptions;
}) {
  const { storageKey = 'tg-kit-fullscreen', persistPreference = true } = options;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isOrientationLocked, setIsOrientationLocked] = useState(false);
  const [lastError, setLastError] = useState<{ error: 'UNSUPPORTED' | 'ALREADY_FULLSCREEN' } | null>(null);
  const [safeArea, setSafeArea] = useState<SafeAreaInset>(ZERO_INSET);
  const [contentSafeArea, setContentSafeArea] = useState<SafeAreaInset>(ZERO_INSET);

  const initializedRef = useRef(false);

  const savePreference = useCallback((value: boolean) => {
    if (!persistPreference) return;
    try { localStorage.setItem(storageKey, String(value)); } catch {}
  }, [storageKey, persistPreference]);

  const enterFullscreen = useCallback(() => {
    const wa = getWebApp();
    if (!wa?.requestFullscreen) return;
    setLastError(null);
    try { wa.requestFullscreen(); savePreference(true); } catch {}
  }, [savePreference]);

  const exitFullscreen = useCallback(() => {
    const wa = getWebApp();
    if (!wa?.exitFullscreen) return;
    try { wa.exitFullscreen(); savePreference(false); } catch {}
  }, [savePreference]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen(); else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;

    setIsSupported(typeof wa.requestFullscreen === 'function');
    setIsFullscreen(Boolean(wa.isFullscreen));
    setIsActive(Boolean(wa.isActive));
    setIsOrientationLocked(Boolean(wa.isOrientationLocked));

    if (wa.safeAreaInset) {
      setSafeArea(wa.safeAreaInset);
      applySafeAreaVars(wa.safeAreaInset);
    }
    if (wa.contentSafeAreaInset) {
      setContentSafeArea(wa.contentSafeAreaInset);
      applyContentSafeAreaVars(wa.contentSafeAreaInset);
    }

    const onFullscreen = () => {
      setIsFullscreen(Boolean(getWebApp()?.isFullscreen));
      setIsOrientationLocked(Boolean(getWebApp()?.isOrientationLocked));
    };

    const onFullscreenFailed = (...args: unknown[]) => {
      const err = args[0];
      if (err && typeof err === 'object' && 'error' in err) {
        setLastError(err as { error: 'UNSUPPORTED' | 'ALREADY_FULLSCREEN' });
      }
    };

    const onActivated = () => setIsActive(true);
    const onDeactivated = () => setIsActive(false);

    const onSafeArea = () => {
      const inset = getWebApp()?.safeAreaInset;
      if (!inset) return;
      setSafeArea(inset);
      applySafeAreaVars(inset);
    };

    const onContentSafeArea = () => {
      const inset = getWebApp()?.contentSafeAreaInset;
      if (!inset) return;
      setContentSafeArea(inset);
      applyContentSafeAreaVars(inset);
    };

    const onOrientationLocked = () => {
      setIsOrientationLocked(Boolean(getWebApp()?.isOrientationLocked));
    };

    wa.onEvent('fullscreenChanged', onFullscreen);
    wa.onEvent('fullscreenFailed', onFullscreenFailed);
    wa.onEvent('activated', onActivated);
    wa.onEvent('deactivated', onDeactivated);
    wa.onEvent('safeAreaChanged', onSafeArea);
    wa.onEvent('contentSafeAreaChanged', onContentSafeArea);
    wa.onEvent('orientationLockedChanged', onOrientationLocked);

    if (!initializedRef.current && persistPreference) {
      initializedRef.current = true;
      try {
        const saved = localStorage.getItem(storageKey) === 'true';
        if (saved && !wa.isFullscreen && wa.requestFullscreen) {
          setTimeout(() => wa.requestFullscreen?.(), 100);
        }
      } catch {}
    }

    return () => {
      wa.offEvent('fullscreenChanged', onFullscreen);
      wa.offEvent('fullscreenFailed', onFullscreenFailed);
      wa.offEvent('activated', onActivated);
      wa.offEvent('deactivated', onDeactivated);
      wa.offEvent('safeAreaChanged', onSafeArea);
      wa.offEvent('contentSafeAreaChanged', onContentSafeArea);
      wa.offEvent('orientationLockedChanged', onOrientationLocked);
    };
  }, [storageKey, persistPreference]);

  return (
    <FullscreenContext.Provider
      value={{
        isFullscreen,
        isSupported,
        isActive,
        isOrientationLocked,
        safeArea,
        contentSafeArea,
        lastError,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
      }}
    >
      {children}
    </FullscreenContext.Provider>
  );
}