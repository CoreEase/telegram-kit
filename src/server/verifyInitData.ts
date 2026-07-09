import type { RuntimeMode, TgUser } from '../types/webapp';

type NodeCrypto = typeof import('node:crypto');
let _nodeCryptoPromise: Promise<NodeCrypto> | null = null;
async function getNodeCrypto(): Promise<NodeCrypto> {
  if (!_nodeCryptoPromise) {
    _nodeCryptoPromise = import('node:crypto');
  }
  return _nodeCryptoPromise;
}

function getNodeCryptoSync(): NodeCrypto {
  return require('node:crypto') as NodeCrypto;
}

export interface ValidateInitDataOptions {
  maxAgeSeconds?: number;
  runtime?: RuntimeMode;
  parseUser?: boolean;
  strict?: boolean;
  skipAuthDateCheck?: boolean;
  extractStartParam?: boolean;
  extractChat?: boolean;
  parseUnsafeData?: boolean;
}

export interface ValidateInitDataResult<TUser = TgUser> {
  valid: boolean;
  reason?: 'invalid_hash' | 'expired' | 'missing_hash' | 'malformed';
  data?: Record<string, string>;
  authDate?: number;
  user?: TUser;
  startParam?: string | null;
  chatType?: string | null;
  chatInstance?: string | null;
  rawInitData?: string;
}

interface ParsedInitData {
  data: Record<string, string>;
  hash: string | null;
  authDate: string | null;
  startParam: string | null;
  chatType: string | null;
  chatInstance: string | null;
}

function normalizeInitData(initData: string): string {
  if (initData.includes('hash=')) {
    return initData;
  }

  if (!initData.includes('%26hash%3D')) {
    return initData;
  }

  try {
    const decoded = decodeURIComponent(initData);

    if (
      decoded.includes('user=') &&
      decoded.includes('auth_date=') &&
      decoded.includes('hash=')
    ) {
      return decoded;
    }
  } catch {}

  return initData;
}

function parseInitData(initData: string): ParsedInitData {
  const params = new URLSearchParams(initData);

  const hash = params.get('hash');
  const authDate = params.get('auth_date');
  const startParam = params.get('start_param');
  const chatType = params.get('chat_type');
  const chatInstance = params.get('chat_instance');

  params.delete('hash');

  const data: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    data[k] = v;
  }

  return { data, hash, authDate, startParam, chatType, chatInstance };
}

function buildDataCheckString(data: Record<string, string>): string {
  return Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
}

function hexToUint8Array(hex: string): Uint8Array {
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function verifyEdge(dataCheckString: string, botToken: string, hash: string): Promise<boolean> {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const secret = await crypto.subtle.sign('HMAC', key, enc.encode(botToken));

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));

  const computedBytes = new Uint8Array(signature);
  const hashBytes = hexToUint8Array(hash);

  return timingSafeEqualBytes(computedBytes, hashBytes);
}

async function verifyNode(dataCheckString: string, botToken: string, hash: string): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await getNodeCrypto();
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const hashBuffer = Buffer.from(hash, 'hex');
  if (hashBuffer.length !== computed.length) return false;
  return timingSafeEqual(hashBuffer, computed);
}

function verifyNodeSync(dataCheckString: string, botToken: string, hash: string): boolean {
  const { createHmac, timingSafeEqual } = getNodeCryptoSync();
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const hashBuffer = Buffer.from(hash, 'hex');
  if (hashBuffer.length !== computed.length) return false;
  return timingSafeEqual(hashBuffer, computed);
}

export async function validateInitData<TUser = TgUser>(
  initData: string,
  botToken: string,
  options: ValidateInitDataOptions = {}
): Promise<ValidateInitDataResult<TUser>> {
  const {
    maxAgeSeconds = 86400,
    runtime = 'node',
    parseUser = true,
    strict = false,
    skipAuthDateCheck = false,
    extractStartParam = true,
    extractChat = true,
    parseUnsafeData = false,
  } = options;

  if (!initData || typeof initData !== 'string') {
    if (strict) throw new Error('malformed initData');
    return { valid: false, reason: 'malformed' };
  }

  let parsed: ParsedInitData;
  try {
    initData = normalizeInitData(initData);
    parsed = parseInitData(initData);
  } catch {
    if (strict) throw new Error('malformed initData');
    return { valid: false, reason: 'malformed' };
  }

  const { data, hash, authDate: authDateStr } = parsed;

  if (!hash) {
    if (strict) throw new Error('missing_hash');
    return { valid: false, reason: 'missing_hash' };
  }

  const dataCheckString = buildDataCheckString(data);

  const isValid =
    runtime === 'edge'
      ? await verifyEdge(dataCheckString, botToken, hash)
      : await verifyNode(dataCheckString, botToken, hash);

  if (!isValid) {
    if (strict) throw new Error('invalid_hash');
    return { valid: false, reason: 'invalid_hash' };
  }

  const authDate = authDateStr ? Number(authDateStr) : 0;

  if (!skipAuthDateCheck) {
    if (!authDate || Number.isNaN(authDate)) {
      if (strict) throw new Error('malformed auth_date');
      return { valid: false, reason: 'malformed' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) {
      if (strict) throw new Error('expired');
      return { valid: false, reason: 'expired', authDate };
    }
  }

  let parsedUser: TUser | undefined;
  if (parseUser && data.user) {
    try {
      parsedUser = JSON.parse(data.user);
    } catch {
      if (strict) throw new Error('invalid_user_json');
    }
  }

  const startParam = extractStartParam ? data.start_param ?? null : undefined;
  const chatType = extractChat ? data.chat_type ?? null : undefined;
  const chatInstance = extractChat ? data.chat_instance ?? null : undefined;

  return {
    valid: true,
    data,
    authDate,
    user: parsedUser,
    startParam,
    chatType,
    chatInstance,
    rawInitData: parseUnsafeData ? initData : undefined,
  };
}

export function validateInitDataSync<TUser = TgUser>(
  initData: string,
  botToken: string,
  options: ValidateInitDataOptions = {}
): ValidateInitDataResult<TUser> {
  const {
    maxAgeSeconds = 86400,
    parseUser = true,
    strict = false,
    skipAuthDateCheck = false,
    extractStartParam = true,
    extractChat = true,
    parseUnsafeData = false,
  } = options;

  if (!initData || typeof initData !== 'string') {
    if (strict) throw new Error('malformed initData');
    return { valid: false, reason: 'malformed' };
  }

  let parsed: ParsedInitData;
  try {
    initData = normalizeInitData(initData);
    parsed = parseInitData(initData);
  } catch {
    if (strict) throw new Error('malformed initData');
    return { valid: false, reason: 'malformed' };
  }

  const { data, hash, authDate: authDateStr } = parsed;

  if (!hash) {
    if (strict) throw new Error('missing_hash');
    return { valid: false, reason: 'missing_hash' };
  }

  const dataCheckString = buildDataCheckString(data);
  const isValid = verifyNodeSync(dataCheckString, botToken, hash);

  if (!isValid) {
    if (strict) throw new Error('invalid_hash');
    return { valid: false, reason: 'invalid_hash' };
  }

  const authDate = authDateStr ? Number(authDateStr) : 0;

  if (!skipAuthDateCheck) {
    if (!authDate || Number.isNaN(authDate)) {
      if (strict) throw new Error('malformed auth_date');
      return { valid: false, reason: 'malformed' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) {
      if (strict) throw new Error('expired');
      return { valid: false, reason: 'expired', authDate };
    }
  }

  let parsedUser: TUser | undefined;
  if (parseUser && data.user) {
    try {
      parsedUser = JSON.parse(data.user);
    } catch {
      if (strict) throw new Error('invalid_user_json');
    }
  }

  const startParam = extractStartParam ? data.start_param ?? null : undefined;
  const chatType = extractChat ? data.chat_type ?? null : undefined;
  const chatInstance = extractChat ? data.chat_instance ?? null : undefined;

  return {
    valid: true,
    data,
    authDate,
    user: parsedUser,
    startParam,
    chatType,
    chatInstance,
    rawInitData: parseUnsafeData ? initData : undefined,
  };
}
