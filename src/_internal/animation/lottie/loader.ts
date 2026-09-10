import { gunzip, isGzip, bytesToUtf8 } from "../inflate/gunzip";
import type { LottieAnimation } from "./types";

export type TgsSource =
  | string 
  | ArrayBuffer
  | Uint8Array
  | LottieAnimation
  | Record<string, unknown>;

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const atobFn = (globalThis as typeof globalThis & { atob?: (value: string) => string }).atob;
  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: { from(value: string, encoding: string): Uint8Array };
    }
  ).Buffer;

  if (!atobFn && !bufferCtor) {
    throw new Error("[@core-ease/telegram-kit] : base64 decoding is unavailable in this runtime");
  }

  const binary = atobFn
    ? atobFn(padded)
    : bufferCtor!.from(padded, "base64");
  if (typeof binary !== "string") return new Uint8Array(binary);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function looksLikeBase64(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 8) return false;
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed) && trimmed.length % 4 <= 1;
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[@core-ease/telegram-kit] : failed to fetch "${url}" (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}

function bytesToJson(bytes: Uint8Array): LottieAnimation {
  const data = isGzip(bytes) ? gunzip(bytes) : bytes;
  const text = bytesToUtf8(data);
  return normalizeDocument(JSON.parse(text));
}

function normalizeDocument(value: unknown, sourceUrl?: string): LottieAnimation {
  if (!value || typeof value !== "object") {
    throw new Error("[@core-ease/telegram-kit] : animation source must be a JSON object");
  }

  const doc = value as Partial<LottieAnimation>;
  if (
    typeof doc.w !== "number" ||
    typeof doc.h !== "number" ||
    typeof doc.fr !== "number" ||
    typeof doc.ip !== "number" ||
    typeof doc.op !== "number" ||
    !Array.isArray(doc.layers)
  ) {
    throw new Error(
      "[@core-ease/telegram-kit] : invalid Lottie document (w, h, fr, ip, op and layers are required)"
    );
  }

  if (sourceUrl) {
    try {
      Object.defineProperty(doc, "__sourceUrl", {
        configurable: true,
        enumerable: false,
        value: sourceUrl,
      });
    } catch {
      doc.__sourceUrl = sourceUrl;
    }
  }

  return doc as LottieAnimation;
}

export async function loadTgsSource(src: TgsSource): Promise<LottieAnimation> {
  if (src instanceof ArrayBuffer) {
    return bytesToJson(new Uint8Array(src));
  }

  if (src instanceof Uint8Array) {
    return bytesToJson(src);
  }

  if (typeof src === "object" && src !== null) {
    return normalizeDocument(src);
  }

  if (typeof src === "string") {
    const trimmed = src.trim();

    if (trimmed.startsWith("{")) {
      return normalizeDocument(JSON.parse(trimmed));
    }

    if (trimmed.startsWith("data:")) {
      const comma = trimmed.indexOf(",");
      const meta = trimmed.slice(5, comma);
      const payload = trimmed.slice(comma + 1);
      const bytes = meta.includes("base64") ? base64ToBytes(payload) : new TextEncoder().encode(decodeURIComponent(payload));
      return bytesToJson(bytes);
    }

    if (looksLikeBase64(trimmed)) {
      try {
        return bytesToJson(base64ToBytes(trimmed));
      } catch {
      }
    }
    
    const base =
      typeof window !== "undefined"
        ? window.location.href
        : typeof globalThis.location !== "undefined"
          ? globalThis.location.href
          : undefined;
    let url: URL;
    try {
      url = new URL(trimmed, base);
    } catch {
      throw new Error(
        `[@core-ease/telegram-kit] : relative animation URL "${trimmed}" requires a browser base URL`
      );
    }
    const buffer = await fetchArrayBuffer(url.toString());
    return normalizeDocument(bytesToJson(new Uint8Array(buffer)), url.toString());
  }

  throw new Error("[@core-ease/telegram-kit] : unsupported `src` type");
}
