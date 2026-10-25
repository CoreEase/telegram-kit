import { gunzip } from "../animation/inflate/gunzip";
import type { MeshManifest, SceneManifest } from "./types";
import { fromQuat, identity, mul, scaling, translation, type Mat4 } from "./math";

export interface DecodedMesh {
  name: string;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint16Array | Uint32Array | null;
  vertexCount: number;
  pre: Mat4;
  post: Mat4;
  hasAnimNode: boolean;
  manifest: MeshManifest;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function local(n: {
  position: number[] | null;
  scale: number[] | null;
  orientation: number[] | null;
}): Mat4 {
  const p = n.position ?? [0, 0, 0],
    s = n.scale ?? [1, 1, 1],
    q = n.orientation ?? [0, 0, 0, 1];
  return mul(
    translation(p[0], p[1], p[2]),
    mul(fromQuat(q[0], q[1], q[2], q[3]), scaling(s[0], s[1], s[2])),
  );
}

export function decodeScene(
  manifest: SceneManifest,
  b64: string,
  animNode = "star",
): DecodedMesh[] {
  const raw = gunzip(b64ToBytes(b64));
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  if (buf.byteLength !== manifest.byteLength)
    throw new Error(`mesh buffer size mismatch (${buf.byteLength} != ${manifest.byteLength})`);
  return manifest.meshes.map((m) => {
    const n = m.vertexCount,
      o = m.offsets;
    const position = new Float32Array(buf, o.position, n * 3);
    const nrm16 = new Int16Array(buf, o.normal, n * 3);
    const normal = new Float32Array(n * 3);
    for (let i = 0; i < nrm16.length; i++) normal[i] = nrm16[i] / 32767;
    const uv = new Float32Array(buf, o.uv, n * 2);
    let index: Uint16Array | Uint32Array | null = null;
    if (m.indexCount) {
      index =
        m.indexType === "u32"
          ? new Uint32Array(buf, o.index, m.indexCount)
          : new Uint16Array(buf, o.index, m.indexCount);
    }

    const chain = m.chain;
    const ai = chain.findIndex((c) => c.name === animNode);
    let pre = identity(),
      post = identity();
    if (ai < 0) {
      for (const c of chain) pre = mul(pre, local(c));
    } else {
      for (let i = 0; i < ai; i++) pre = mul(pre, local(chain[i]));
      const a = chain[ai];
      const p = a.position ?? [0, 0, 0];
      pre = mul(pre, translation(p[0], p[1], p[2]));
      const s = a.scale ?? [1, 1, 1],
        q = a.orientation ?? [0, 0, 0, 1];
      post = mul(fromQuat(q[0], q[1], q[2], q[3]), scaling(s[0], s[1], s[2]));
      for (let i = ai + 1; i < chain.length; i++) post = mul(post, local(chain[i]));
    }

    return {
      name: m.name,
      position,
      normal,
      uv,
      index,
      vertexCount: n,
      pre,
      post,
      hasAnimNode: ai >= 0,
      manifest: m,
    };
  });
}
