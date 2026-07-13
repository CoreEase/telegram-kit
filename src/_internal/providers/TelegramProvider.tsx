import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import {
  getWebApp,
  isInTelegram,
  expand,
  ready as markReady,
  enableClosingConfirmation,
  disableVerticalSwipes,
  setHeaderColor,
  setBackgroundColor,
  setBottomBarColor,
} from '../../core';
import { isDevMode } from '../../core/dev';
import type { TgUser, TgWebApp } from '../../types';

export interface TelegramContextValue {
  ready: boolean;
  inTelegram: boolean;
  isDevBypass: boolean;
  webApp: TgWebApp | null;
  user: TgUser | null;
  colorScheme: 'light' | 'dark';
  startParam: string | null;
}

export interface TelegramProviderOptions {
  onUserReady?: (user: TgUser) => void;
  onReady?: (wa: TgWebApp) => void;
  loadingComponent?: ReactNode;
  notInTelegramComponent?: ReactNode;
  allowOutsideTelegram?: boolean;
  autoExpand?: boolean;
  autoDisableVerticalSwipes?: boolean;
  autoEnableClosingConfirmation?: boolean;
  headerColor?: string;
  backgroundColor?: string;
  bottomBarColor?: string;
}

const defaultCtx: TelegramContextValue = {
  ready: false,
  inTelegram: false,
  isDevBypass: false,
  webApp: null,
  user: null,
  colorScheme: 'dark',
  startParam: null,
};

const TelegramContext = createContext<TelegramContextValue>(defaultCtx);

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}

function applyColorScheme(scheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  if (scheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function TelegramProvider({
  children,
  options = {},
}: {
  children: ReactNode;
  options?: TelegramProviderOptions;
}) {
  const {
    onUserReady,
    onReady,
    loadingComponent = null,
    notInTelegramComponent = null,
    allowOutsideTelegram = false,
    autoExpand = true,
    autoDisableVerticalSwipes = true,
    autoEnableClosingConfirmation = false,
    headerColor,
    backgroundColor,
    bottomBarColor,
  } = options;

  const onUserReadyRef = useRef(onUserReady);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onUserReadyRef.current = onUserReady; });
  useEffect(() => { onReadyRef.current = onReady; });

  const [isInitialized, setIsInitialized] = useState(false);
  const [ctx, setCtx] = useState<TelegramContextValue>(defaultCtx);

  useLayoutEffect(() => {
    const wa = getWebApp();
    const inTg = isInTelegram();
    const devBypass = !inTg && isDevMode();

    let user: TgUser | null = null;
    let startParam: string | null = null;
    let colorScheme: 'light' | 'dark' = 'dark';

    if (wa) {
      if (autoExpand) expand();
      if (autoDisableVerticalSwipes) disableVerticalSwipes();
      if (autoEnableClosingConfirmation) enableClosingConfirmation();

      colorScheme = wa.colorScheme ?? 'dark';
      user = wa.initDataUnsafe?.user ?? null;
      startParam = wa.initDataUnsafe?.start_param ?? null;

      if (user) onUserReadyRef.current?.(user);
      onReadyRef.current?.(wa);
    }

    applyColorScheme(colorScheme);

    setCtx({
      ready: true,
      inTelegram: inTg,
      isDevBypass: devBypass,
      webApp: wa,
      user,
      colorScheme,
      startParam,
    });

    setIsInitialized(true);

    markReady();
  }, [autoExpand, autoDisableVerticalSwipes, autoEnableClosingConfirmation]);

  useEffect(() => {
    if (!ctx.ready) return;
    if (headerColor) setHeaderColor(headerColor);
    if (backgroundColor) setBackgroundColor(backgroundColor);
    if (bottomBarColor) setBottomBarColor(bottomBarColor);
  }, [ctx.ready, headerColor, backgroundColor, bottomBarColor]);

  useEffect(() => {
    const wa = ctx.webApp;
    if (!wa) return;

    const handleThemeChanged = () => {
      const scheme = wa.colorScheme ?? 'dark';
      applyColorScheme(scheme);
      setCtx((prev) => (prev.colorScheme === scheme ? prev : { ...prev, colorScheme: scheme }));
    };

    wa.onEvent('themeChanged', handleThemeChanged);
    return () => wa.offEvent('themeChanged', handleThemeChanged);
  }, [ctx.webApp]);

  if (!isInitialized) return <>{loadingComponent}</>;

  if (ctx.ready && !ctx.inTelegram && !ctx.isDevBypass && !allowOutsideTelegram) {
    return <>{notInTelegramComponent}</>;
  }

  return (
    <TelegramContext.Provider value={ctx}>
      {children}
    </TelegramContext.Provider>
  );
}
