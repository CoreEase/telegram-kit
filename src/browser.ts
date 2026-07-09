export * from './core';
export * from './types/webapp';

export {
  loadTelegramScript,
  getTelegramCdnUrl,
} from './cdn';

export {
  createMockWebApp,
  installDevMode,
  isDevMode,
} from './dev';
