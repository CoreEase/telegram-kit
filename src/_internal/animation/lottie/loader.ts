import { gunzip, isGzip, bytesToUtf8 } from "../inflate/gunzip";
import type { LottieAnimation } from "./types";

export type TgsSource =
  | string 
  | ArrayBuffer
  | Uint8Array
  | LottieAnimation
  | Record<string, unknown>;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function looksLikeBase64(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 8) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0;
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[telegram-kit] : failed to fetch "${url}" (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}

function bytesToJson(bytes: Uint8Array): LottieAnimation {
  const data = isGzip(bytes) ? gunzip(bytes) : bytes;
  const text = bytesToUtf8(data);
  return JSON.parse(text);
}

export async function loadTgsSource(src: TgsSource): Promise<LottieAnimation> {
  if (src instanceof ArrayBuffer) {
    return bytesToJson(new Uint8Array(src));
  }

  if (src instanceof Uint8Array) {
    return bytesToJson(src);
  }

  if (typeof src === "object" && src !== null) {
    return src as LottieAnimation;
  }

  if (typeof src === "string") {
    const trimmed = src.trim();

    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
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
    
    const url = new URL(trimmed, typeof window !== "undefined" ? window.location.href : undefined);
    const buffer = await fetchArrayBuffer(url.toString());
    return bytesToJson(new Uint8Array(buffer));
  }

  throw new Error("[telegram-kit] : unsupported `src` type");
}
