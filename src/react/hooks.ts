import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebApp } from '../core';
import type {
  TgUser,
  TgWebApp,
  WebAppEventType,
  DownloadFileParams,
  EmojiStatusParams,
  StoryShareParams,
  LocationData,
  SafeAreaInset,
  RequestChatParams,
} from '../types/webapp';

export function useTelegramWebApp(): TgWebApp | null {
  const [wa, setWa] = useState<TgWebApp | null>(null);
  useEffect(() => { setWa(getWebApp()); }, []);
  return wa;
}

export function useTelegramUser(): TgUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function useTelegramStartParam(): string | null {
  return getWebApp()?.initDataUnsafe?.start_param ?? null;
}

export function useInitData(): string | null {
  const [data, setData] = useState<string | null>(() => getWebApp()?.initData ?? null);
  useEffect(() => {
    setData(getWebApp()?.initData ?? null);
  }, []);
  return data;
}

export function useReady(): void {
  useEffect(() => {
    const wa = getWebApp();
    wa?.ready();
  }, []);
}

export function useShowPopup(): (params: {
  title?: string;
  message: string;
  buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text?: string;
  }>;
}) => Promise<string | null> {
  return useCallback((params) => {
    return new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.showPopup) return reject(new Error('showPopup not available'));
      try {
        wa.showPopup(params, (id) => resolve(id ?? null));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }, []);
}

export function useShowConfirm(): (message: string) => Promise<boolean> {
  return useCallback((message) => {
    return new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.showConfirm) return reject(new Error('showConfirm not available'));
      wa.showConfirm(message, (ok) => resolve(Boolean(ok)));
    });
  }, []);
}

export function useShowAlert(): (message: string) => Promise<void> {
  return useCallback((message) => {
    return new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.showAlert) return reject(new Error('showAlert not available'));
      wa.showAlert(message, () => resolve());
    });
  }, []);
}

export function useScanQrPopup(): (params?: { text?: string }) => Promise<string | null> {
  return useCallback((params) => {
    return new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.showScanQrPopup) return reject(new Error('showScanQrPopup not available'));
      wa.showScanQrPopup(params ?? {}, (text) => {
        wa.closeScanQrPopup?.();
        resolve(text ?? null);
        return true;
      });
    });
  }, []);
}

export function useReadTextFromClipboard(): () => Promise<string | null> {
  return useCallback(() => {
    return new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.readTextFromClipboard) return reject(new Error('readTextFromClipboard not available'));
      wa.readTextFromClipboard((text) => resolve(text ?? null));
    });
  }, []);
}

export function useTelegramEvent(
  eventType: WebAppEventType | string,
  handler: (...args: unknown[]) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    const cb = (...args: unknown[]) => handlerRef.current(...args);
    wa.onEvent(eventType, cb);
    return () => wa.offEvent(eventType, cb);
  }, [eventType]);
}

export function useTelegramBackButton(options?: {
  pathname?: string;
  onBack?: () => void;
  hideOnRoot?: boolean;
}): void {
  const { pathname = '/', onBack, hideOnRoot = true } = options ?? {};

  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.BackButton) return;

    const handleBack = onBack ?? (() => {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        wa.close();
      }
    });

    wa.onEvent('backButtonClicked', handleBack);

    if (hideOnRoot && pathname === '/') {
      wa.BackButton.hide();
    } else {
      wa.BackButton.show();
    }

    return () => {
      wa.offEvent('backButtonClicked', handleBack);
      wa.BackButton?.hide();
    };
  }, [pathname, onBack, hideOnRoot]);
}

export function useTelegramMainButton(options: {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isActive?: boolean;
  color?: string;
  textColor?: string;
  hasShineEffect?: boolean;
  showProgress?: boolean;
}): void {
  const {
    text, onClick, isVisible = true, isActive = true,
    color, textColor, hasShineEffect, showProgress,
  } = options;

  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.MainButton) return;
    const btn = wa.MainButton;

    btn.setText(text);
    btn.setParams({
      is_active: isActive,
      is_visible: isVisible,
      ...(color && { color }),
      ...(textColor && { text_color: textColor }),
      ...(hasShineEffect !== undefined && { has_shine_effect: hasShineEffect }),
    });

    if (showProgress) btn.showProgress();
    else btn.hideProgress();

    btn.onClick(onClick);

    return () => {
      btn.offClick(onClick);
      btn.hide();
    };
  }, [text, onClick, isVisible, isActive, color, textColor, hasShineEffect, showProgress]);
}

export function useTelegramSecondaryButton(options: {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isActive?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  color?: string;
  textColor?: string;
}): void {
  const {
    text, onClick, isVisible = true, isActive = true,
    position = 'left', color, textColor,
  } = options;

  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.SecondaryButton) return;
    const btn = wa.SecondaryButton;

    btn.setText(text);
    btn.setParams({
      is_active: isActive,
      is_visible: isVisible,
      position,
      ...(color && { color }),
      ...(textColor && { text_color: textColor }),
    });

    btn.onClick(onClick);

    return () => {
      btn.offClick(onClick);
      btn.hide();
    };
  }, [text, onClick, isVisible, isActive, position, color, textColor]);
}

export function useTelegramSettingsButton(onClick: () => void): void {
  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.SettingsButton) return;
    wa.SettingsButton.show();
    wa.SettingsButton.onClick(onClick);
    return () => {
      wa.SettingsButton?.offClick(onClick);
      wa.SettingsButton?.hide();
    };
  }, [onClick]);
}

export function useHapticFeedback() {
  return {
    impact: useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      getWebApp()?.HapticFeedback?.impactOccurred(style);
    }, []),
    notification: useCallback((type: 'error' | 'success' | 'warning') => {
      getWebApp()?.HapticFeedback?.notificationOccurred(type);
    }, []),
    selectionChanged: useCallback(() => {
      getWebApp()?.HapticFeedback?.selectionChanged();
    }, []),
  };
}

export function useTelegramTheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    () => getWebApp()?.colorScheme ?? 'dark'
  );
  const [themeParams, setThemeParams] = useState(
    () => getWebApp()?.themeParams ?? {}
  );

  useTelegramEvent('themeChanged', () => {
    const wa = getWebApp();
    if (!wa) return;
    setColorScheme(wa.colorScheme);
    setThemeParams(wa.themeParams);
  });

  return { colorScheme, themeParams, isDark: colorScheme === 'dark' };
}

export function useTelegramViewport() {
  const [viewport, setViewport] = useState(() => ({
    height: getWebApp()?.viewportHeight ?? 0,
    stableHeight: getWebApp()?.viewportStableHeight ?? 0,
    isExpanded: getWebApp()?.isExpanded ?? false,
  }));

  useTelegramEvent('viewportChanged', () => {
    const wa = getWebApp();
    if (!wa) return;
    setViewport({
      height: wa.viewportHeight,
      stableHeight: wa.viewportStableHeight,
      isExpanded: wa.isExpanded,
    });
  });

  const expand = useCallback(() => getWebApp()?.expand(), []);
  return { ...viewport, expand };
}

export function useTelegramFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => Boolean(getWebApp()?.isFullscreen)
  );
  const [error, setError] = useState<{ error: string } | null>(null);

  useTelegramEvent('fullscreenChanged', () => {
    setIsFullscreen(Boolean(getWebApp()?.isFullscreen));
  });

  useTelegramEvent('fullscreenFailed', (...args) => {
    const err = args[0];
    if (err && typeof err === 'object' && 'error' in err) {
      setError(err as { error: string });
    }
  });

  const enter = useCallback(() => {
    setError(null);
    getWebApp()?.requestFullscreen?.();
  }, []);

  const exit = useCallback(() => { getWebApp()?.exitFullscreen?.(); }, []);
  const toggle = useCallback(() => {
    if (isFullscreen) exit(); else enter();
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, error, enter, exit, toggle };
}

export function useOrientationLock() {
  const [isLocked, setIsLocked] = useState(
    () => Boolean(getWebApp()?.isOrientationLocked)
  );

  useTelegramEvent('fullscreenChanged', () => {
    setIsLocked(Boolean(getWebApp()?.isOrientationLocked));
  });

  const lock = useCallback(() => {
    getWebApp()?.lockOrientation?.();
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    getWebApp()?.unlockOrientation?.();
    setIsLocked(false);
  }, []);

  return { isLocked, lock, unlock };
}

export function useSafeArea() {
  const zero: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };
  const [safeArea, setSafeArea] = useState<SafeAreaInset>(
    () => getWebApp()?.safeAreaInset ?? zero
  );
  const [contentSafeArea, setContentSafeArea] = useState<SafeAreaInset>(
    () => getWebApp()?.contentSafeAreaInset ?? zero
  );

  useTelegramEvent('safeAreaChanged', () => {
    const inset = getWebApp()?.safeAreaInset;
    if (inset) setSafeArea(inset);
  });

  useTelegramEvent('contentSafeAreaChanged', () => {
    const inset = getWebApp()?.contentSafeAreaInset;
    if (inset) setContentSafeArea(inset);
  });

  return { safeArea, contentSafeArea };
}

export function useIsActive(): boolean {
  const [isActive, setIsActive] = useState(() => Boolean(getWebApp()?.isActive));
  useTelegramEvent('activated', () => setIsActive(true));
  useTelegramEvent('deactivated', () => setIsActive(false));
  return isActive;
}

export function useCloudStorage() {
  const setItem = useCallback((key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.setItem(key, value, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }), []);

  const getItem = useCallback((key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getItem(key, (err, val) => {
        if (err) reject(new Error(err)); else resolve(val);
      });
    }), []);

  const getItems = useCallback((keys: string[]): Promise<Record<string, string>> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getItems(keys, (err, vals) => {
        if (err) reject(new Error(err)); else resolve(vals ?? {});
      });
    }), []);

  const removeItem = useCallback((key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.removeItem(key, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }), []);

  const removeItems = useCallback((keys: string[]): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.removeItems(keys, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }), []);

  const getKeys = useCallback((): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getKeys((err, keys) => {
        if (err) reject(new Error(err)); else resolve(keys ?? []);
      });
    }), []);

  return { setItem, getItem, getItems, removeItem, removeItems, getKeys };
}

export function useDeviceStorage() {
  const setItem = useCallback((key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.setItem(key, value, (err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  const getItem = useCallback((key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.getItem(key, (err, val) => { if (err) reject(new Error(err)); else resolve(val); });
    }), []);

  const removeItem = useCallback((key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.removeItem(key, (err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  const clear = useCallback((): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.clear((err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  return { setItem, getItem, removeItem, clear };
}

export function useSecureStorage() {
  const setItem = useCallback((key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.setItem(key, value, (err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  const getItem = useCallback((key: string): Promise<{ value: string | null | undefined; canRestore: boolean }> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.getItem(key, (err, val, canRestore) => {
        if (err) reject(new Error(err)); else resolve({ value: val, canRestore: canRestore ?? false });
      });
    }), []);

  const removeItem = useCallback((key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.removeItem(key, (err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  const clear = useCallback((): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.clear((err, ok) => { if (err) reject(new Error(err)); else resolve(ok ?? false); });
    }), []);

  const restoreItem = useCallback((key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.restoreItem(key, (err, val) => { if (err) reject(new Error(err)); else resolve(val); });
    }), []);

  return { setItem, getItem, removeItem, clear, restoreItem };
}

export function useAccelerometer(options?: { refreshRate?: number; autoStart?: boolean }) {
  const { refreshRate = 100, autoStart = false } = options ?? {};
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [isStarted, setIsStarted] = useState(() => Boolean(getWebApp()?.Accelerometer?.isStarted));

  useTelegramEvent('accelerometerChanged', () => {
    const acc = getWebApp()?.Accelerometer;
    if (acc) setData({ x: acc.x, y: acc.y, z: acc.z });
  });
  useTelegramEvent('accelerometerStarted', () => setIsStarted(true));
  useTelegramEvent('accelerometerStopped', () => setIsStarted(false));

  const start = useCallback(() => {
    getWebApp()?.Accelerometer?.start({ refresh_rate: refreshRate });
  }, [refreshRate]);

  const stop = useCallback(() => { getWebApp()?.Accelerometer?.stop(); }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => { if (autoStart) stop(); };
  }, [autoStart, start, stop]);

  return { ...data, isStarted, start, stop };
}

export function useGyroscope(options?: { refreshRate?: number; autoStart?: boolean }) {
  const { refreshRate = 100, autoStart = false } = options ?? {};
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [isStarted, setIsStarted] = useState(() => Boolean(getWebApp()?.Gyroscope?.isStarted));

  useTelegramEvent('gyroscopeChanged', () => {
    const g = getWebApp()?.Gyroscope;
    if (g) setData({ x: g.x, y: g.y, z: g.z });
  });
  useTelegramEvent('gyroscopeStarted', () => setIsStarted(true));
  useTelegramEvent('gyroscopeStopped', () => setIsStarted(false));

  const start = useCallback(() => {
    getWebApp()?.Gyroscope?.start({ refresh_rate: refreshRate });
  }, [refreshRate]);

  const stop = useCallback(() => { getWebApp()?.Gyroscope?.stop(); }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => { if (autoStart) stop(); };
  }, [autoStart, start, stop]);

  return { ...data, isStarted, start, stop };
}

export function useDeviceOrientation(options?: {
  refreshRate?: number;
  needAbsolute?: boolean;
  autoStart?: boolean;
}) {
  const { refreshRate = 100, needAbsolute = false, autoStart = false } = options ?? {};
  const [data, setData] = useState({ alpha: 0, beta: 0, gamma: 0, absolute: false });
  const [isStarted, setIsStarted] = useState(() => Boolean(getWebApp()?.DeviceOrientation?.isStarted));

  useTelegramEvent('deviceOrientationChanged', () => {
    const ori = getWebApp()?.DeviceOrientation;
    if (ori) setData({ alpha: ori.alpha ?? 0, beta: ori.beta ?? 0, gamma: ori.gamma ?? 0, absolute: ori.absolute });
  });
  useTelegramEvent('deviceOrientationStarted', () => setIsStarted(true));
  useTelegramEvent('deviceOrientationStopped', () => setIsStarted(false));

  const start = useCallback(() => {
    getWebApp()?.DeviceOrientation?.start({ refresh_rate: refreshRate, need_absolute: needAbsolute });
  }, [refreshRate, needAbsolute]);

  const stop = useCallback(() => { getWebApp()?.DeviceOrientation?.stop(); }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => { if (autoStart) stop(); };
  }, [autoStart, start, stop]);

  return { ...data, isStarted, start, stop };
}

export function useBiometric() {
  const [isInited, setIsInited] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'finger' | 'face' | 'unknown'>('unknown');

  useTelegramEvent('biometricManagerUpdated', () => {
    const bio = getWebApp()?.BiometricManager;
    if (!bio) return;
    setIsInited(bio.isInited);
    setIsAvailable(bio.isBiometricAvailable);
    setBiometricType(bio.biometricType);
  });

  const init = useCallback((): Promise<void> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available'));
      bio.init(() => {
        setIsInited(bio.isInited);
        setIsAvailable(bio.isBiometricAvailable);
        setBiometricType(bio.biometricType);
        resolve();
      });
    }), []);

  const requestAccess = useCallback((reason?: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available'));
      bio.requestAccess({ reason }, resolve);
    }), []);

  const authenticate = useCallback((reason?: string): Promise<{ authenticated: boolean; token?: string }> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available'));
      bio.authenticate({ reason }, (authenticated, token) => resolve({ authenticated, token }));
    }), []);

  const updateBiometricToken = useCallback((token: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available'));
      bio.updateBiometricToken(token, resolve);
    }), []);

  const openSettings = useCallback(() => {
    getWebApp()?.BiometricManager?.openSettings();
  }, []);

  return { isInited, isAvailable, biometricType, init, requestAccess, authenticate, updateBiometricToken, openSettings };
}

export function useLocation() {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isInited, setIsInited] = useState(false);
  const [isGranted, setIsGranted] = useState(false);

  useTelegramEvent('locationManagerUpdated', () => {
    const loc = getWebApp()?.LocationManager;
    if (!loc) return;
    setIsInited(loc.isInited);
    setIsGranted(loc.isAccessGranted);
  });

  useTelegramEvent('locationRequested', (...args) => {
    const data = args[0];
    if (data && typeof data === 'object' && 'locationData' in data) {
      setLocationData((data as { locationData: LocationData }).locationData);
    }
  });

  const init = useCallback((): Promise<void> =>
    new Promise((resolve, reject) => {
      const loc = getWebApp()?.LocationManager;
      if (!loc) return reject(new Error('LocationManager not available (Bot API 8.0+)'));
      loc.init(() => {
        setIsInited(loc.isInited);
        setIsGranted(loc.isAccessGranted);
        resolve();
      });
    }), []);

  const getLocation = useCallback((): Promise<LocationData | null> =>
    new Promise((resolve, reject) => {
      const loc = getWebApp()?.LocationManager;
      if (!loc) return reject(new Error('LocationManager not available (Bot API 8.0+)'));
      loc.getLocation((data) => { setLocationData(data); resolve(data); });
    }), []);

  const openSettings = useCallback(() => {
    getWebApp()?.LocationManager?.openSettings();
  }, []);

  return { locationData, isInited, isGranted, init, getLocation, openSettings };
}

export function useHomeScreen() {
  const [status, setStatus] = useState<'unsupported' | 'unknown' | 'added' | 'missed' | null>(null);

  useTelegramEvent('homeScreenAdded', () => setStatus('added'));
  useTelegramEvent('homeScreenChecked', (...args) => {
    const data = args[0];
    if (data && typeof data === 'object' && 'status' in data) {
      setStatus((data as { status: 'unsupported' | 'unknown' | 'added' | 'missed' }).status);
    }
  });

  const addToHomeScreen = useCallback(() => {
    getWebApp()?.addToHomeScreen?.();
  }, []);

  const checkHomeScreenStatus = useCallback(() => {
    getWebApp()?.checkHomeScreenStatus?.((s) => setStatus(s));
  }, []);

  return { status, addToHomeScreen, checkHomeScreenStatus };
}

export function useShareToStory() {
  return useCallback((mediaUrl: string, params?: StoryShareParams) => {
    getWebApp()?.shareToStory?.(mediaUrl, params);
  }, []);
}

export function useShareMessage() {
  return useCallback((msgId: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.shareMessage) return reject(new Error('shareMessage not supported (Bot API 8.0+)'));
      wa.shareMessage(msgId, resolve);
    }), []);
}

export function useSetEmojiStatus() {
  return useCallback((customEmojiId: string, params?: EmojiStatusParams): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.setEmojiStatus) return reject(new Error('setEmojiStatus not supported (Bot API 8.0+)'));
      wa.setEmojiStatus(customEmojiId, params, resolve);
    }), []);
}

export function useRequestEmojiStatusAccess() {
  return useCallback((): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.requestEmojiStatusAccess)
        return reject(new Error('requestEmojiStatusAccess not supported (Bot API 8.0+)'));
      wa.requestEmojiStatusAccess(resolve);
    }), []);
}

export function useDownloadFile() {
  return useCallback((params: DownloadFileParams): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.downloadFile) return reject(new Error('downloadFile not supported (Bot API 8.0+)'));
      wa.downloadFile(params, resolve);
    }), []);
}

export function useRequestWriteAccess() {
  return useCallback((): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.requestWriteAccess)
        return reject(new Error('requestWriteAccess not supported (Bot API 6.9+)'));
      wa.requestWriteAccess(resolve);
    }), []);
}

export function useRequestContact() {
  return useCallback((): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.requestContact)
        return reject(new Error('requestContact not supported (Bot API 6.9+)'));
      wa.requestContact(resolve);
    }), []);
}

export function useSwitchInlineQuery() {
  return useCallback((
    query: string,
    chooseChatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>
  ) => {
    getWebApp()?.switchInlineQuery?.(query, chooseChatTypes);
  }, []);
}

export function useRequestChat() {
  return useCallback((params: RequestChatParams): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.requestChat)
        return reject(new Error('requestChat not supported (Bot API 6.9+)'));
      wa.requestChat(params, resolve);
    }), []);
}

export function useHideKeyboard() {
  return useCallback(() => {
    getWebApp()?.hideKeyboard?.();
  }, []);
}

export function useInvokeCustomMethod() {
  return useCallback((method: string, params: object = {}): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.invokeCustomMethod)
        return reject(new Error('invokeCustomMethod not supported (Bot API 7.7+)'));
      wa.invokeCustomMethod(method, params, (error, result) => {
        if (error) reject(new Error(error));
        else resolve(result);
      });
    }), []);
}
