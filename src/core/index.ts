import type {
  TgUser,
  TgWebApp,
  DownloadFileParams,
  EmojiStatusParams,
  StoryShareParams,
  LocationData,
  PopupParams,
  RequestChatParams,
} from '../types/webapp';

export function getWebApp(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isInTelegram(): boolean {
  const wa = getWebApp();
  return Boolean(wa && wa.initData && wa.initData.length > 0);
}

export function isVersionAtLeast(version: string): boolean {
  return getWebApp()?.isVersionAtLeast(version) ?? false;
}

export function getRawUserData(): TgUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function getUserDisplayName(user?: TgUser): string {
  if (!user) return 'User';
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return `User_${user.id}`;
}

export function getUserIdentifier(user?: TgUser): string {
  if (user?.username) return user.username;
  if (user?.id) return String(user.id);
  return 'unknown';
}

export function getUserAvatarUrl(
  user?: TgUser,
  fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IndoaXRlIj4/PC90ZXh0Pjwvc3ZnPg=='
): string {
  if (user?.photo_url) return user.photo_url;

  if (user?.id) {
    const name =
      `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
      user.username ||
      `user_${user.id}`;

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100%" height="100%" rx="50" fill="#4F46E5"/>
        <text
          x="50%"
          y="50%"
          dominant-baseline="middle"
          text-anchor="middle"
          font-family="Arial,sans-serif"
          font-size="40"
          font-weight="bold"
          fill="white"
        >
          ${initials}
        </text>
      </svg>
    `;

    const base64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(svg).toString('base64')
        : btoa(svg);

    return `data:image/svg+xml;base64,${base64}`;
  }

  return fallback;
}

export function getUserInfoWithAvatar() {
  const wa = getWebApp();
  const user = wa?.initDataUnsafe?.user;
  return {
    user,
    avatarUrl: getUserAvatarUrl(user),
    displayName: getUserDisplayName(user),
    identifier: getUserIdentifier(user),
  };
}

export function openExternalLink(url: string, tryInstantView = false): void {
  const wa = getWebApp();
  if (wa?.openLink) {
    wa.openLink(url, { try_instant_view: tryInstantView });
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

export function openTelegramLink(url: string): void {
  const wa = getWebApp();
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

export function openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa) return reject(new Error('WebApp not available'));
    wa.openInvoice(url, (status) => resolve(status as 'paid' | 'cancelled' | 'failed' | 'pending'));
  });
}

export function switchInlineQuery(
  query: string,
  chooseChatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>
): void {
  getWebApp()?.switchInlineQuery?.(query, chooseChatTypes);
}

export function hideKeyboard(): void {
  getWebApp()?.hideKeyboard?.();
}

export const haptic = {
  light: () => getWebApp()?.HapticFeedback?.impactOccurred('light'),
  medium: () => getWebApp()?.HapticFeedback?.impactOccurred('medium'),
  heavy: () => getWebApp()?.HapticFeedback?.impactOccurred('heavy'),
  rigid: () => getWebApp()?.HapticFeedback?.impactOccurred('rigid'),
  soft: () => getWebApp()?.HapticFeedback?.impactOccurred('soft'),
  success: () => getWebApp()?.HapticFeedback?.notificationOccurred('success'),
  warning: () => getWebApp()?.HapticFeedback?.notificationOccurred('warning'),
  error: () => getWebApp()?.HapticFeedback?.notificationOccurred('error'),
  selection: () => getWebApp()?.HapticFeedback?.selectionChanged(),
};

export const cloudStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.setItem(key, value, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  getItem: (key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getItem(key, (err, val) => {
        if (err) reject(new Error(err)); else resolve(val);
      });
    }),

  getItems: (keys: string[]): Promise<Record<string, string>> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getItems(keys, (err, vals) => {
        if (err) reject(new Error(err)); else resolve(vals ?? {});
      });
    }),

  removeItem: (key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.removeItem(key, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  removeItems: (keys: string[]): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.removeItems(keys, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  getKeys: (): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const wa = getWebApp();
      if (!wa?.CloudStorage) return reject(new Error('CloudStorage not available'));
      wa.CloudStorage.getKeys((err, keys) => {
        if (err) reject(new Error(err)); else resolve(keys ?? []);
      });
    }),
};

export const deviceStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.setItem(key, value, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  getItem: (key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.getItem(key, (err, val) => {
        if (err) reject(new Error(err)); else resolve(val);
      });
    }),

  removeItem: (key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.removeItem(key, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  clear: (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ds = getWebApp()?.DeviceStorage;
      if (!ds) return reject(new Error('DeviceStorage not available (Bot API 9.0+)'));
      ds.clear((err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),
};

export const secureStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.setItem(key, value, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  getItem: (key: string): Promise<{ value: string | null | undefined; canRestore: boolean }> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.getItem(key, (err, val, canRestore) => {
        if (err) reject(new Error(err)); else resolve({ value: val, canRestore: canRestore ?? false });
      });
    }),

  removeItem: (key: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.removeItem(key, (err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  clear: (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.clear((err, ok) => {
        if (err) reject(new Error(err)); else resolve(ok ?? false);
      });
    }),

  restoreItem: (key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const ss = getWebApp()?.SecureStorage;
      if (!ss) return reject(new Error('SecureStorage not available (Bot API 9.0+)'));
      ss.restoreItem(key, (err, val) => {
        if (err) reject(new Error(err)); else resolve(val);
      });
    }),
};

export const dialog = {
  alert: (message: string): Promise<void> =>
    new Promise((resolve) => {
      const wa = getWebApp();
      if (!wa) {
        if (typeof window !== 'undefined') alert(message);
        resolve();
        return;
      }
      wa.showAlert(message, resolve);
    }),

  confirm: (message: string): Promise<boolean> =>
    new Promise((resolve) => {
      const wa = getWebApp();
      if (!wa) {
        resolve(typeof window !== 'undefined' && window.confirm(message));
        return;
      }
      wa.showConfirm(message, resolve);
    }),

  popup: (params: PopupParams): Promise<string | null> =>
    new Promise((resolve) => {
      const wa = getWebApp();
      if (!wa) { resolve(null); return; }
      wa.showPopup(params, (buttonId) => resolve(buttonId ?? null));
    }),

  prompt: (message: string, defaultValue = ''): Promise<string | null> =>
    new Promise((resolve) => {
      if (typeof window === 'undefined') { resolve(null); return; }
      const result = window.prompt(message, defaultValue);
      resolve(result);
    }),
};

export function readClipboard(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.readTextFromClipboard) return reject(new Error('readTextFromClipboard not supported'));
    wa.readTextFromClipboard((text) => resolve(text ?? null));
  });
}

export function scanQr(text?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa) return reject(new Error('WebApp not available'));
    wa.showScanQrPopup({ text }, (result) => {
      wa.closeScanQrPopup();
      resolve(result);
      return true;
    });
  });
}

export function shareToStory(mediaUrl: string, params?: StoryShareParams): void {
  getWebApp()?.shareToStory?.(mediaUrl, params);
}

export function shareMessage(msgId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.shareMessage) return reject(new Error('shareMessage not supported (Bot API 8.0+)'));
    wa.shareMessage(msgId, resolve);
  });
}

export function setEmojiStatus(
  customEmojiId: string,
  params?: EmojiStatusParams
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.setEmojiStatus) return reject(new Error('setEmojiStatus not supported (Bot API 8.0+)'));
    wa.setEmojiStatus(customEmojiId, params, resolve);
  });
}

export function requestEmojiStatusAccess(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.requestEmojiStatusAccess)
      return reject(new Error('requestEmojiStatusAccess not supported (Bot API 8.0+)'));
    wa.requestEmojiStatusAccess(resolve);
  });
}

export function downloadFile(params: DownloadFileParams): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.downloadFile) return reject(new Error('downloadFile not supported (Bot API 8.0+)'));
    wa.downloadFile(params, resolve);
  });
}

export function requestWriteAccess(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.requestWriteAccess)
      return reject(new Error('requestWriteAccess not supported (Bot API 6.9+)'));
    wa.requestWriteAccess(resolve);
  });
}

export function requestContact(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.requestContact)
      return reject(new Error('requestContact not supported (Bot API 6.9+)'));
    wa.requestContact(resolve);
  });
}

export function requestChat(params: RequestChatParams): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.requestChat)
      return reject(new Error('requestChat not supported (Bot API 6.9+)'));
    wa.requestChat(params, resolve);
  });
}

export function invokeCustomMethod(
  method: string,
  params: object = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const wa = getWebApp();
    if (!wa?.invokeCustomMethod)
      return reject(new Error('invokeCustomMethod not supported (Bot API 7.7+)'));
    wa.invokeCustomMethod(method, params, (error, result) => {
      if (error) reject(new Error(error));
      else resolve(result);
    });
  });
}

export const biometric = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available (Bot API 7.2+)'));
      bio.init(resolve);
    }),

  requestAccess: (reason?: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available (Bot API 7.2+)'));
      bio.requestAccess({ reason }, resolve);
    }),

  authenticate: (reason?: string): Promise<{ authenticated: boolean; token?: string }> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available (Bot API 7.2+)'));
      bio.authenticate({ reason }, (authenticated, token) => resolve({ authenticated, token }));
    }),

  updateBiometricToken: (token: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const bio = getWebApp()?.BiometricManager;
      if (!bio) return reject(new Error('BiometricManager not available (Bot API 7.2+)'));
      bio.updateBiometricToken(token, resolve);
    }),

  openSettings: (): void => {
    getWebApp()?.BiometricManager?.openSettings();
  },
};

export const location = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) => {
      const loc = getWebApp()?.LocationManager;
      if (!loc) return reject(new Error('LocationManager not available (Bot API 8.0+)'));
      loc.init(() => resolve());
    }),

  getLocation: (): Promise<LocationData | null> =>
    new Promise((resolve, reject) => {
      const loc = getWebApp()?.LocationManager;
      if (!loc) return reject(new Error('LocationManager not available (Bot API 8.0+)'));
      loc.getLocation((data) => resolve(data));
    }),

  openSettings: (): void => {
    getWebApp()?.LocationManager?.openSettings();
  },
};
