import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import { getWebApp, isInTelegram } from '../core';
import { isDevMode } from '../dev';
import type { TgUser, TgWebApp } from '../types';

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
      if (autoExpand) {
        try { wa.expand(); } catch {}
      }
      if (autoDisableVerticalSwipes) {
        try { wa.disableVerticalSwipes?.(); } catch {}
      }
      if (autoEnableClosingConfirmation) {
        try { wa.enableClosingConfirmation?.(); } catch {}
      }

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

    try { wa?.ready(); } catch {}
  }, [autoExpand, autoDisableVerticalSwipes, autoEnableClosingConfirmation]);

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
