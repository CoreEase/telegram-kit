import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getWebApp,
  haptic,
  cloudStorage,
  deviceStorage,
  secureStorage,
  dialog,
  readClipboard,
  scanQr,
  shareToStory as coreShareToStory,
  shareMessage as coreShareMessage,
  setEmojiStatus as coreSetEmojiStatus,
  requestEmojiStatusAccess as coreRequestEmojiStatusAccess,
  downloadFile as coreDownloadFile,
  requestWriteAccess as coreRequestWriteAccess,
  requestContact as coreRequestContact,
  requestChat as coreRequestChat,
  switchInlineQuery as coreSwitchInlineQuery,
  hideKeyboard as coreHideKeyboard,
  invokeCustomMethod as coreInvokeCustomMethod,
  fullscreen,
  orientation,
  addToHomeScreen as coreAddToHomeScreen,
  checkHomeScreenStatus as coreCheckHomeScreenStatus,
  biometric,
  location as coreLocation,
  safeInvoke,
} from '../core';
import type {
  TgUser,
  TgWebApp,
  WebAppEventType,
  DownloadFileParams,
  EmojiStatusParams,
  StoryShareParams,
  LocationData,
  SafeAreaInset,
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
  return useCallback((params) => dialog.popup(params), []);
}

export function useShowConfirm(): (message: string) => Promise<boolean> {
  return useCallback((message) => dialog.confirm(message), []);
}

export function useShowAlert(): (message: string) => Promise<void> {
  return useCallback((message) => dialog.alert(message), []);
}

export function useScanQrPopup(): (params?: { text?: string }) => Promise<string | null> {
  return useCallback((params) => scanQr(params?.text), []);
}

export function useReadTextFromClipboard(): () => Promise<string | null> {
  return useCallback(() => readClipboard(), []);
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
  rootPath?: string;
  onBeforeBack?: () => boolean;
}): void {
  const {
    pathname = "/",
    onBack,
    hideOnRoot = true,
    rootPath = "/",
    onBeforeBack,
  } = options ?? {};

  const onBeforeBackRef = useRef(onBeforeBack);
  onBeforeBackRef.current = onBeforeBack;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.BackButton) return;

    const handleBack = () => {
      if (onBeforeBackRef.current?.()) return;

      if (onBackRef.current) {
        onBackRef.current();
        return;
      }

      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      } else {
        wa.close();
      }
    };

    wa.offEvent("backButtonClicked", handleBack);
    wa.onEvent("backButtonClicked", handleBack);

    const isRoot =
      hideOnRoot &&
      (pathname === rootPath ||
        pathname === `${rootPath}/` ||
        pathname.startsWith(`${rootPath}?`) ||
        pathname.startsWith(`${rootPath}/?`));

    if (isRoot) {
      wa.BackButton.hide();
    } else {
      wa.BackButton.show();
    }

    return () => {
      wa.offEvent("backButtonClicked", handleBack);
    };
  }, [pathname, hideOnRoot, rootPath]);
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
      haptic[style]();
    }, []),
    notification: useCallback((type: 'error' | 'success' | 'warning') => {
      haptic[type]();
    }, []),
    selectionChanged: useCallback(() => {
      haptic.selection();
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

  const expand = useCallback(() => { safeInvoke(() => getWebApp()?.expand()); }, []);
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
    fullscreen.enter();
  }, []);

  const exit = useCallback(() => { fullscreen.exit(); }, []);
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
    orientation.lock();
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    orientation.unlock();
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
  return {
    setItem: useCallback(cloudStorage.setItem, []),
    getItem: useCallback(cloudStorage.getItem, []),
    getItems: useCallback(cloudStorage.getItems, []),
    removeItem: useCallback(cloudStorage.removeItem, []),
    removeItems: useCallback(cloudStorage.removeItems, []),
    getKeys: useCallback(cloudStorage.getKeys, []),
  };
}

export function useDeviceStorage() {
  return {
    setItem: useCallback(deviceStorage.setItem, []),
    getItem: useCallback(deviceStorage.getItem, []),
    removeItem: useCallback(deviceStorage.removeItem, []),
    clear: useCallback(deviceStorage.clear, []),
  };
}

export function useSecureStorage() {
  return {
    setItem: useCallback(secureStorage.setItem, []),
    getItem: useCallback(secureStorage.getItem, []),
    removeItem: useCallback(secureStorage.removeItem, []),
    clear: useCallback(secureStorage.clear, []),
    restoreItem: useCallback(secureStorage.restoreItem, []),
  };
}

export function useAccelerometer(options?: { refreshRate?: number; autoStart?: boolean }) {
  const { refreshRate = 100, autoStart = false } = options ?? {};
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [isStarted, setIsStarted] = useState(() => Boolean(getWebApp()?.Accelerometer?.isStarted));

  useTelegramEvent('accelerometerChanged', () => {
    const acc = getWebApp()?.Accelerometer;
    if (acc) setData({ 
      x: acc.x ?? 0, 
      y: acc.y ?? 0, 
      z: acc.z ?? 0 
    });
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
    if (g) setData({ 
      x: g.x ?? 0, 
      y: g.y ?? 0, 
      z: g.z ?? 0 
    });
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
    biometric.init().then(() => {
      const bio = getWebApp()?.BiometricManager;
      if (bio) {
        setIsInited(bio.isInited);
        setIsAvailable(bio.isBiometricAvailable);
        setBiometricType(bio.biometricType);
      }
    }), []);

  const requestAccess = useCallback((reason?: string): Promise<boolean> => biometric.requestAccess(reason), []);

  const authenticate = useCallback(
    (reason?: string): Promise<{ authenticated: boolean; token?: string }> => biometric.authenticate(reason),
    []
  );

  const updateBiometricToken = useCallback((token: string): Promise<boolean> => biometric.updateBiometricToken(token), []);

  const openSettings = useCallback(() => {
    biometric.openSettings();
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
    coreLocation.init().then(() => {
      const loc = getWebApp()?.LocationManager;
      if (loc) {
        setIsInited(loc.isInited);
        setIsGranted(loc.isAccessGranted);
      }
    }), []);

  const getLocation = useCallback((): Promise<LocationData | null> =>
    coreLocation.getLocation().then((data) => {
      setLocationData(data);
      return data;
    }), []);

  const openSettings = useCallback(() => {
    coreLocation.openSettings();
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
    coreAddToHomeScreen();
  }, []);

  const checkHomeScreenStatus = useCallback(() => {
    coreCheckHomeScreenStatus().then((s) => setStatus(s));
  }, []);

  return { status, addToHomeScreen, checkHomeScreenStatus };
}

export function useShareToStory() {
  return useCallback((mediaUrl: string, params?: StoryShareParams) => {
    coreShareToStory(mediaUrl, params);
  }, []);
}

export function useShareMessage() {
  return useCallback((msgId: string): Promise<boolean> => coreShareMessage(msgId), []);
}

export function useSetEmojiStatus() {
  return useCallback(
    (customEmojiId: string, params?: EmojiStatusParams): Promise<boolean> => coreSetEmojiStatus(customEmojiId, params),
    []
  );
}

export function useRequestEmojiStatusAccess() {
  return useCallback((): Promise<boolean> => coreRequestEmojiStatusAccess(), []);
}

export function useDownloadFile() {
  return useCallback((params: DownloadFileParams): Promise<boolean> => coreDownloadFile(params), []);
}

export function useRequestWriteAccess() {
  return useCallback((): Promise<boolean> => coreRequestWriteAccess(), []);
}

export function useRequestContact() {
  return useCallback((): Promise<boolean> => coreRequestContact(), []);
}

export function useSwitchInlineQuery() {
  return useCallback((
    query: string,
    chooseChatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>
  ) => {
    coreSwitchInlineQuery(query, chooseChatTypes);
  }, []);
}

/**
 * Opens Telegram's native chat-request dialog for a chat request you
 * already created server-side, identified by `reqId`. Requires Bot API
 * 9.6+.
 */
export function useRequestChat() {
  return useCallback((reqId: string): Promise<boolean> => coreRequestChat(reqId), []);
}

export function useHideKeyboard() {
  return useCallback(() => {
    coreHideKeyboard();
  }, []);
}

export function useInvokeCustomMethod() {
  return useCallback(
    (method: string, params: object = {}): Promise<unknown> => coreInvokeCustomMethod(method, params),
    []
  );
}
