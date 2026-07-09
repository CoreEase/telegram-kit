import type {
  TgWebApp,
  TgUser,
  TgThemeParams,
  BottomButton,
  BackButton,
  SettingsButton,
  HapticFeedback,
  CloudStorage,
  DeviceStorage,
  SecureStorage,
  Accelerometer,
  Gyroscope,
  DeviceOrientation,
  LocationManager,
  LocationData,
  BiometricManager,
  SafeAreaInset,
  WebAppInitData,
} from '../types/webapp';

export interface DevModeOptions {
  user?: Partial<TgUser>;
  colorScheme?: 'light' | 'dark';
  platform?: string;
  version?: string;
  startParam?: string;
  viewport?: { height?: number; stableHeight?: number };
  showIndicator?: boolean;
  mockStorage?: Record<string, string>;
}

const DEFAULT_USER: TgUser = {
  id: 123456789,
  first_name: 'Dev',
  last_name: 'User',
  username: 'dev_user',
  language_code: 'en',
  is_premium: false,
};

function getAppTheme(): TgThemeParams {
  if (typeof document === 'undefined') {
    return {
      bg_color: '#0f0f0f',
      secondary_bg_color: '#101010',
      text_color: '#f5f5f5',
      hint_color: '#7a7a7a',
      link_color: '#6ab3f3',
      button_color: '#f5f5f5',
      button_text_color: '#262626',
      header_bg_color: '#0f0f0f',
      accent_text_color: '#6ab3f3',
      section_bg_color: '#101010',
      section_header_text_color: '#6ab3f3',
      section_separator_color: '#ffffff14',
      subtitle_text_color: '#7a7a7a',
      destructive_text_color: '#f16060',
      bottom_bar_bg_color: '#0f0f0f',
    };
  }

  const root = document.documentElement;
  const styles = getComputedStyle(root);

  const getColor = (varName: string, fallback: string): string => {
    const value = styles.getPropertyValue(varName).trim();
    return value || fallback;
  };

  const isDark = getColor('--color-scheme', 'dark') === 'dark' || 
                 getColor('--background', '#0f0f0f') === '#0f0f0f';

  return {
    bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
    secondary_bg_color: getColor('--secondary', isDark ? '#101010' : '#f1f1f1'),
    text_color: getColor('--foreground', isDark ? '#f5f5f5' : '#000000'),
    hint_color: getColor('--muted-foreground', isDark ? '#7a7a7a' : '#999999'),
    link_color: getColor('--primary', isDark ? '#6ab3f3' : '#2678b6'),
    button_color: getColor('--primary', isDark ? '#f5f5f5' : '#2678b6'),
    button_text_color: getColor('--primary-foreground', isDark ? '#262626' : '#ffffff'),
    header_bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
    accent_text_color: getColor('--accent-foreground', isDark ? '#6ab3f3' : '#168acd'),
    section_bg_color: getColor('--card', isDark ? '#101010' : '#ffffff'),
    section_header_text_color: getColor('--accent-foreground', isDark ? '#6ab3f3' : '#168acd'),
    section_separator_color: getColor('--border', isDark ? '#ffffff14' : '#e7e7e7'),
    subtitle_text_color: getColor('--muted-foreground', isDark ? '#7a7a7a' : '#999999'),
    destructive_text_color: getColor('--destructive', isDark ? '#f16060' : '#cc2929'),
    bottom_bar_bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
  };
}

function createMockStorage(initial: Record<string, string> = {}): CloudStorage {
  const store: Record<string, string> = { ...initial };

  return {
    setItem(key, value, callback) {
      store[key] = value;
      callback?.(null, true);
      return this;
    },
    getItem(key, callback) {
      callback(null, store[key]);
      return this;
    },
    getItems(keys, callback) {
      const result: Record<string, string> = {};
      keys.forEach((k) => { if (k in store) result[k] = store[k]; });
      callback(null, result);
      return this;
    },
    removeItem(key, callback) {
      delete store[key];
      callback?.(null, true);
      return this;
    },
    removeItems(keys, callback) {
      keys.forEach((k) => delete store[k]);
      callback?.(null, true);
      return this;
    },
    getKeys(callback) {
      callback(null, Object.keys(store));
      return this;
    },
  };
}

function createMockButton(type: 'main' | 'secondary'): BottomButton {
  const btn: BottomButton = {
    type,
    text: type === 'main' ? 'Main Button' : 'Secondary Button',
    color: '#2678b6',
    textColor: '#ffffff',
    isVisible: false,
    isActive: true,
    hasShineEffect: false,
    isProgressVisible: false,
    position: type === 'secondary' ? 'left' : undefined,
    setText(text) { btn.text = text; return btn; },
    setParams(params) {
      if (params.text !== undefined) btn.text = params.text;
      if (params.color !== undefined) btn.color = params.color;
      if (params.text_color !== undefined) btn.textColor = params.text_color;
      if (params.is_active !== undefined) btn.isActive = params.is_active;
      if (params.is_visible !== undefined) btn.isVisible = params.is_visible;
      if (params.has_shine_effect !== undefined) btn.hasShineEffect = params.has_shine_effect;
      return btn;
    },
    show() { btn.isVisible = true; return btn; },
    hide() { btn.isVisible = false; return btn; },
    enable() { btn.isActive = true; return btn; },
    disable() { btn.isActive = false; return btn; },
    showProgress() { return btn; },
    hideProgress() { return btn; },
    onClick() { return btn; },
    offClick() { return btn; },
  };
  return btn;
}

function createMockBackButton(): BackButton {
  const btn: BackButton = {
    isVisible: false,
    show() { btn.isVisible = true; return btn; },
    hide() { btn.isVisible = false; return btn; },
    onClick() { return btn; },
    offClick() { return btn; },
  };
  return btn;
}

function createMockSettingsButton(): SettingsButton {
  const btn: SettingsButton = {
    isVisible: false,
    show() { btn.isVisible = true; return btn; },
    hide() { btn.isVisible = false; return btn; },
    onClick() { return btn; },
    offClick() { return btn; },
  };
  return btn;
}

function createMockHaptic(): HapticFeedback {
  const h: HapticFeedback = {
    impactOccurred() { return h; },
    notificationOccurred() { return h; },
    selectionChanged() { return h; },
  };
  return h;
}

interface MockWebApp extends TgWebApp {
  _emit(type: string, ...args: unknown[]): void;
}

export function createMockWebApp(options: DevModeOptions = {}): TgWebApp {
  const {
    user: userOverride,
    colorScheme: schemeOverride,
    platform = 'tdesktop',
    version = '8.0',
    startParam,
    viewport,
    mockStorage = {},
  } = options;

  const user: TgUser = { ...DEFAULT_USER, ...userOverride };
  const appTheme = getAppTheme();
  
  const isDark = schemeOverride 
    ? schemeOverride === 'dark'
    : appTheme.bg_color === '#0f0f0f' || appTheme.bg_color === '#17212b';
  
  const theme = schemeOverride
    ? (schemeOverride === 'light' 
        ? {
            bg_color: '#ffffff',
            secondary_bg_color: '#f1f1f1',
            text_color: '#000000',
            hint_color: '#999999',
            link_color: '#2678b6',
            button_color: '#2678b6',
            button_text_color: '#ffffff',
            header_bg_color: '#527da3',
            accent_text_color: '#168acd',
            section_bg_color: '#ffffff',
            section_header_text_color: '#168acd',
            section_separator_color: '#e7e7e7',
            subtitle_text_color: '#999999',
            destructive_text_color: '#cc2929',
            bottom_bar_bg_color: '#ffffff',
          }
        : {
            bg_color: '#17212b',
            secondary_bg_color: '#232e3c',
            text_color: '#f5f5f5',
            hint_color: '#708499',
            link_color: '#6ab3f3',
            button_color: '#5288c1',
            button_text_color: '#ffffff',
            header_bg_color: '#17212b',
            accent_text_color: '#6ab3f3',
            section_bg_color: '#17212b',
            section_header_text_color: '#6ab3f3',
            section_separator_color: '#111921',
            subtitle_text_color: '#708499',
            destructive_text_color: '#ec3942',
            bottom_bar_bg_color: '#17212b',
          })
    : appTheme;

  const listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  const safeArea: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

  const initData: WebAppInitData = {
    query_id: 'dev_query_' + Date.now(),
    user,
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'dev_hash_0000000000000000000000000000000000000000000000000000000000000000',
    start_param: startParam,
  };

  const mock: MockWebApp = {
    initData: Object.entries(initData)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? encodeURIComponent(JSON.stringify(v)) : v}`)
      .join('&'),
    initDataUnsafe: initData,
    version,
    platform,
    colorScheme: isDark ? 'dark' : 'light',
    themeParams: theme,
    isActive: true,
    isExpanded: true,
    viewportHeight: viewport?.height ?? window.innerHeight,
    viewportStableHeight: viewport?.stableHeight ?? window.innerHeight,
    headerColor: theme.header_bg_color ?? theme.bg_color ?? (isDark ? '#0f0f0f' : '#ffffff'),
    backgroundColor: theme.bg_color ?? (isDark ? '#0f0f0f' : '#ffffff'),
    bottomBarColor: theme.bottom_bar_bg_color ?? theme.bg_color ?? (isDark ? '#0f0f0f' : '#ffffff'),
    isClosingConfirmationEnabled: false,
    isVerticalSwipesEnabled: false,
    isFullscreen: false,
    isOrientationLocked: false,
    safeAreaInset: safeArea,
    contentSafeAreaInset: safeArea,
    MainButton: createMockButton('main'),
    SecondaryButton: createMockButton('secondary'),
    BackButton: createMockBackButton(),
    SettingsButton: createMockSettingsButton(),
    HapticFeedback: createMockHaptic(),
    CloudStorage: createMockStorage(mockStorage),

    isVersionAtLeast(v: string) {
      const [mj, mn = 0] = version.split('.').map(Number);
      const [tj, tn = 0] = v.split('.').map(Number);
      return mj > tj || (mj === tj && mn >= tn);
    },

    setHeaderColor(color) { mock.headerColor = color; },
    setBackgroundColor(color) { mock.backgroundColor = color; },
    setBottomBarColor(color) { mock.bottomBarColor = color; },
    enableClosingConfirmation() { mock.isClosingConfirmationEnabled = true; },
    disableClosingConfirmation() { mock.isClosingConfirmationEnabled = false; },
    enableVerticalSwipes() { mock.isVerticalSwipesEnabled = true; },
    disableVerticalSwipes() { mock.isVerticalSwipesEnabled = false; },
    requestFullscreen() { mock.isFullscreen = true; mock._emit('fullscreenChanged'); },
    exitFullscreen() { mock.isFullscreen = false; mock._emit('fullscreenChanged'); },
    _emit(type: string, ...args: unknown[]) {
      listeners.get(type)?.forEach((h) => h(...args));
    },
    lockOrientation() { mock.isOrientationLocked = true; },
    unlockOrientation() { mock.isOrientationLocked = false; },
    addToHomeScreen() {},
    checkHomeScreenStatus(cb) { cb?.('unknown'); },
    ready() {},
    expand() { mock.isExpanded = true; },
    close() { console.warn('[tg-kit dev] WebApp.close() called'); },
    sendData(data) { console.info('[tg-kit dev] sendData:', data); },
    switchInlineQuery(query, types) { console.info('[tg-kit dev] switchInlineQuery:', query, types); },
    openLink(url) { window.open(url, '_blank'); },
    openTelegramLink(url) { window.open(url, '_blank'); },
    openInvoice(_url, cb) { cb?.('cancelled'); },
    shareToStory(url, params) { console.info('[tg-kit dev] shareToStory:', url, params); },
    shareMessage(msgId, cb) { console.info('[tg-kit dev] shareMessage:', msgId); cb?.(false); },
    setEmojiStatus(_id, _p, cb) { cb?.(false); },
    requestEmojiStatusAccess(cb) { cb?.(false); },
    downloadFile(params, cb) { console.info('[tg-kit dev] downloadFile:', params); cb?.(false); },
    hideKeyboard() {},
    requestChat(params, cb) { console.info('[tg-kit dev] requestChat:', params); cb?.(false); },

    showPopup(params, cb) {
      const id = params.buttons?.[0]?.id ?? null;
      alert(`[tg-kit dev popup] ${params.title ? params.title + '\n' : ''}${params.message}`);
      cb?.(id);
    },
    showAlert(message, cb) { alert(`[tg-kit dev] ${message}`); cb?.(); },
    showConfirm(message, cb) { cb?.(confirm(`[tg-kit dev] ${message}`)); },
    showScanQrPopup(_params, cb) {
      const text = prompt('[tg-kit dev] Enter QR text:') ?? '';
      if (text) { cb?.(text); return true; }
      return false;
    },
    closeScanQrPopup() {},
    readTextFromClipboard(cb) {
      navigator.clipboard?.readText().then((t) => cb?.(t)).catch(() => cb?.(null));
    },
    requestWriteAccess(cb) { cb?.(true); },
    requestContact(cb) { cb?.(false); },

    invokeCustomMethod(method, params, cb) {
      console.info('[tg-kit dev] invokeCustomMethod:', method, params);
      cb?.(null, { ok: true });
    },

    DeviceStorage: (() => {
      const store: Record<string, string> = {};
      const ds: DeviceStorage = {
        setItem(key, value, cb) { store[key] = value; cb?.(null, true); return ds; },
        getItem(key, cb) { cb(null, store[key]); return ds; },
        removeItem(key, cb) { delete store[key]; cb?.(null, true); return ds; },
        clear(cb) { for (const k of Object.keys(store)) delete store[k]; cb?.(null, true); return ds; },
      };
      return ds;
    })(),

    SecureStorage: (() => {
      const store: Record<string, string> = {};
      const ss: SecureStorage = {
        setItem(key, value, cb) { store[key] = value; cb?.(null, true); return ss; },
        getItem(key, cb) { cb(null, store[key] ?? null, false); return ss; },
        removeItem(key, cb) { delete store[key]; cb?.(null, true); return ss; },
        clear(cb) { for (const k of Object.keys(store)) delete store[k]; cb?.(null, true); return ss; },
        restoreItem(key, cb) { cb?.(null, store[key]); return ss; },
      };
      return ss;
    })(),

    Accelerometer: (() => {
      let _started = false;
      let _interval: ReturnType<typeof setInterval> | null = null;
      const acc: Accelerometer = {
        get isStarted() { return _started; },
        x: 0, y: 0, z: 0,
        start(opts, _cb) {
          _started = true;
          _interval = setInterval(() => { mock._emit('accelerometerChanged'); }, opts?.refresh_rate ?? 100);
          mock._emit('accelerometerStarted');
          return acc;
        },
        stop(_cb) {
          _started = false;
          if (_interval != null) { clearInterval(_interval); _interval = null; }
          mock._emit('accelerometerStopped');
          return acc;
        },
      };
      return acc;
    })(),

    Gyroscope: (() => {
      let _started = false;
      let _interval: ReturnType<typeof setInterval> | null = null;
      const g: Gyroscope = {
        get isStarted() { return _started; },
        x: 0, y: 0, z: 0,
        start(opts, _cb) {
          _started = true;
          _interval = setInterval(() => { mock._emit('gyroscopeChanged'); }, opts?.refresh_rate ?? 100);
          mock._emit('gyroscopeStarted');
          return g;
        },
        stop(_cb) {
          _started = false;
          if (_interval != null) { clearInterval(_interval); _interval = null; }
          mock._emit('gyroscopeStopped');
          return g;
        },
      };
      return g;
    })(),

    DeviceOrientation: (() => {
      let _started = false;
      let _interval: ReturnType<typeof setInterval> | null = null;
      const ori: DeviceOrientation = {
        get isStarted() { return _started; },
        absolute: false,
        alpha: 0, beta: 0, gamma: 0,
        start(opts, _cb) {
          _started = true;
          _interval = setInterval(() => { mock._emit('deviceOrientationChanged'); }, opts?.refresh_rate ?? 100);
          mock._emit('deviceOrientationStarted');
          return ori;
        },
        stop(_cb) {
          _started = false;
          if (_interval != null) { clearInterval(_interval); _interval = null; }
          mock._emit('deviceOrientationStopped');
          return ori;
        },
      };
      return ori;
    })(),

    LocationManager: (() => {
      let _inited = false;
      let _granted = false;
      const loc: LocationManager = {
        get isInited() { return _inited; },
        get isAccessGranted() { return _granted; },
        get isLocationAvailable() { return true; },
        get isAccessRequested() { return _inited; },
        init(cb) {
          _inited = true; _granted = true;
          mock._emit('locationManagerUpdated');
          cb?.(); return loc;
        },
        getLocation(cb) {
          const data: LocationData | null = _granted
            ? { latitude: 51.5074, longitude: -0.1278, altitude: null, course: null, speed: null, horizontal_accuracy: 10, vertical_accuracy: null, course_accuracy: null, speed_accuracy: null }
            : null;
          cb(data); return loc;
        },
        openSettings() { console.info('[tg-kit dev] LocationManager.openSettings()'); return loc; },
      };
      return loc;
    })(),

    BiometricManager: (() => {
      let _inited = false;
      const bio: BiometricManager = {
        get isInited() { return _inited; },
        get isBiometricAvailable() { return false; },
        get biometricType(): 'finger' | 'face' | 'unknown' { return 'unknown'; },
        get isAccessRequested() { return _inited; },
        get isAccessGranted() { return false; },
        get isBiometricTokenSaved() { return false; },
        get deviceId() { return 'dev_device_id'; },
        init(cb) { _inited = true; mock._emit('biometricManagerUpdated'); cb?.(); return bio; },
        requestAccess(_p, cb) { cb?.(false); return bio; },
        authenticate(_p, cb) { cb?.(false); return bio; },
        updateBiometricToken(_t, cb) { cb?.(false); return bio; },
        openSettings() { console.info('[tg-kit dev] BiometricManager.openSettings()'); return bio; },
      };
      return bio;
    })(),

    onEvent(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    offEvent(type, handler) {
      const arr = listeners.get(type);
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i !== -1) arr.splice(i, 1);
    },

  };

  return mock;
}

export interface InstallDevModeOptions extends DevModeOptions {
  force?: boolean;
}

export function installDevMode(options: InstallDevModeOptions = {}): boolean {
  if (typeof window === 'undefined') return false;

  const inTelegram = Boolean(
    window.Telegram?.WebApp?.initData && window.Telegram.WebApp.initData.length > 0
  );

  if (inTelegram && !options.force) return false;

  const mock = createMockWebApp(options);
  window.Telegram = { WebApp: mock };

  if (options.showIndicator !== false) {
    _attachDevIndicator();
  }

  console.info(
    '%c[tg-kit] Dev mode active',
    'background:#2678b6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold'
  );

  return true;
}

function _attachDevIndicator() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('tg-kit-dev-indicator')) return;

  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const bgColor = styles.getPropertyValue('--primary').trim() || '#2678b6';
  const textColor = styles.getPropertyValue('--primary-foreground').trim() || '#ffffff';

  const el = document.createElement('div');
  el.id = 'tg-kit-dev-indicator';
  el.textContent = 'tg-kit dev';
  el.style.cssText = [
    'position:fixed',
    'bottom:8px',
    'right:8px',
    'z-index:999999',
    `background:${bgColor}`,
    `color:${textColor}`,
    'font:bold 11px/1 monospace',
    'padding:4px 8px',
    'border-radius:4px',
    'pointer-events:none',
    'opacity:0.85',
    'letter-spacing:0.5px',
    'box-shadow:0 2px 4px rgba(0,0,0,0.2)',
  ].join(';');

  document.body.appendChild(el);
}

export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    new URLSearchParams(window.location.search).has('tg_dev')
  );
}
