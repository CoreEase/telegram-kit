import type { ShapeKeyframeValue } from "./types";
import { type Mat2D, applyToPoint } from "./matrix";

export interface BezierVertex {
  v: [number, number];
  i: [number, number]; 
  o: [number, number]; 
}

export interface BezierPath {
  closed: boolean;
  vertices: BezierVertex[];
}

const CIRCLE_K = 0.5522847498307936; 

export function shapeValueToBezierPath(sv: ShapeKeyframeValue): BezierPath {
  const vertices: BezierVertex[] = [];
  const count = sv.v?.length ?? 0;
  for (let idx = 0; idx < count; idx++) {
    const v = sv.v[idx] ?? [0, 0];
    const i = sv.i?.[idx] ?? [0, 0];
    const o = sv.o?.[idx] ?? [0, 0];
    vertices.push({ v: [v[0], v[1]], i: [i[0], i[1]], o: [o[0], o[1]] });
  }
  return { closed: !!sv.c, vertices };
}

export function rectToBezierPath(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number
): BezierPath {
  const w = width / 2;
  const h = height / 2;
  const r = Math.max(0, Math.min(radius, w, h));
  const k = r * CIRCLE_K;

  if (r <= 0.01) {
    return {
      closed: true,
      vertices: [
        { v: [cx + w, cy - h], i: [0, 0], o: [0, 0] },
        { v: [cx + w, cy + h], i: [0, 0], o: [0, 0] },
        { v: [cx - w, cy + h], i: [0, 0], o: [0, 0] },
        { v: [cx - w, cy - h], i: [0, 0], o: [0, 0] },
      ],
    };
  }

  return {
    closed: true,
    vertices: [
      { v: [cx + w, cy - h + r], i: [0, -k], o: [0, 0] },
      { v: [cx + w, cy + h - r], i: [0, 0], o: [0, k] },
      { v: [cx + w - r, cy + h], i: [k, 0], o: [0, 0] },
      { v: [cx - w + r, cy + h], i: [0, 0], o: [-k, 0] },
      { v: [cx - w, cy + h - r], i: [0, k], o: [0, 0] },
      { v: [cx - w, cy - h + r], i: [0, 0], o: [0, -k] },
      { v: [cx - w + r, cy - h], i: [-k, 0], o: [0, 0] },
      { v: [cx + w - r, cy - h], i: [0, 0], o: [k, 0] },
    ],
  };
}

export function ellipseToBezierPath(
  cx: number,
  cy: number,
  width: number,
  height: number
): BezierPath {
  const rx = width / 2;
  const ry = height / 2;
  const kx = rx * CIRCLE_K;
  const ky = ry * CIRCLE_K;

  return {
    closed: true,
    vertices: [
      { v: [cx, cy - ry], i: [-kx, 0], o: [kx, 0] },
      { v: [cx + rx, cy], i: [0, -ky], o: [0, ky] },
      { v: [cx, cy + ry], i: [kx, 0], o: [-kx, 0] },
      { v: [cx - rx, cy], i: [0, ky], o: [0, -ky] },
    ],
  };
}

export function starToBezierPath(
  cx: number,
  cy: number,
  points: number,
  outerRadius: number,
  innerRadius: number,
  outerRoundness: number,
  innerRoundness: number,
  rotationDeg: number,
  isPolygon: boolean
): BezierPath {
  const vertices: BezierVertex[] = [];
  const numPoints = Math.max(3, Math.round(points));
  const angleStep = Math.PI / numPoints;
  const startAngle = (rotationDeg - 90) * (Math.PI / 180);

  const totalPoints = isPolygon ? numPoints : numPoints * 2;

  for (let idx = 0; idx < totalPoints; idx++) {
    const isOuter = isPolygon ? true : idx % 2 === 0;
    const radius = isOuter ? outerRadius : innerRadius;
    const angle = startAngle + idx * (isPolygon ? angleStep * 2 : angleStep);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const roundness = (isOuter ? outerRoundness : innerRoundness) / 100;
    const tangentLen = (radius * (Math.PI / (isPolygon ? numPoints : numPoints)) * roundness) / 2;
    const perpAngle = angle + Math.PI / 2;
    const tx = Math.cos(perpAngle) * tangentLen;
    const ty = Math.sin(perpAngle) * tangentLen;

    vertices.push({ v: [x, y], i: [-tx, -ty], o: [tx, ty] });
  }

  return { closed: true, vertices };
}

export function tracePathOnContext(
  ctx: CanvasRenderingContext2D | Path2D,
  path: BezierPath,
  m: Mat2D
): void {
  const verts = path.vertices;
  if (verts.length === 0) return;

  const p0 = applyToPoint(m, verts[0].v[0], verts[0].v[1]);
  ctx.moveTo(p0[0], p0[1]);

  for (let idx = 0; idx < verts.length - 1; idx++) {
    drawSegment(ctx, verts[idx], verts[idx + 1], m);
  }

  if (path.closed && verts.length > 1) {
    drawSegment(ctx, verts[verts.length - 1], verts[0], m);
    ctx.closePath();
  }
}

function drawSegment(
  ctx: CanvasRenderingContext2D | Path2D,
  from: BezierVertex,
  to: BezierVertex,
  m: Mat2D
): void {
  const c1 = applyToPoint(m, from.v[0] + from.o[0], from.v[1] + from.o[1]);
  const c2 = applyToPoint(m, to.v[0] + to.i[0], to.v[1] + to.i[1]);
  const end = applyToPoint(m, to.v[0], to.v[1]);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
}

function flattenSegment(
  from: BezierVertex,
  to: BezierVertex,
  samples: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const p0 = from.v;
  const p1: [number, number] = [from.v[0] + from.o[0], from.v[1] + from.o[1]];
  const p2: [number, number] = [to.v[0] + to.i[0], to.v[1] + to.i[1]];
  const p3 = to.v;

  for (let s = 1; s <= samples; s++) {
    const t = s / samples;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
  return pts;
}

export function flattenPath(
  path: BezierPath,
  samplesPerSegment = 16
): { points: Array<[number, number]>; closed: boolean } {
  const verts = path.vertices;
  const points: Array<[number, number]> = [];
  if (verts.length === 0) return { points, closed: path.closed };

  points.push(verts[0].v);
  for (let idx = 0; idx < verts.length - 1; idx++) {
    points.push(...flattenSegment(verts[idx], verts[idx + 1], samplesPerSegment));
  }
  if (path.closed && verts.length > 1) {
    points.push(...flattenSegment(verts[verts.length - 1], verts[0], samplesPerSegment));
  }
  return { points, closed: path.closed };
}

function polylineLength(points: Array<[number, number]>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    len += Math.hypot(dx, dy);
  }
  return len;
}

export function trimPaths(
  paths: BezierPath[],
  startPct: number,
  endPct: number,
  offsetPct: number
): BezierPath[] {
  if (paths.length === 0) return paths;

  const flattened = paths.map((p) => flattenPath(p, 20));
  const combined: Array<{ pathIdx: number; points: Array<[number, number]> }> =
    flattened.map((f, idx) => ({ pathIdx: idx, points: f.points }));

  const lengths = combined.map((c) => polylineLength(c.points));
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  if (totalLength <= 0) return paths;

  let s = (Math.min(startPct, endPct) / 100 + offsetPct / 360) % 1;
  let e = (Math.max(startPct, endPct) / 100 + offsetPct / 360) % 1;
  if (s < 0) s += 1;
  if (e < 0) e += 1;

  const startDist = s * totalLength;
  const endDist = e * totalLength;
  const wraps = endDist < startDist;

  const resultVertices: BezierVertex[] = [];
  let cursor = 0;

  const pushRange = (lo: number, hi: number) => {
    for (const seg of combined) {
      const segLen = polylineLength(seg.points);
      const segStart = cursor;
      const segEnd = cursor + segLen;
      cursor = segEnd;

      if (segEnd < lo || segStart > hi) continue;

      let acc = segStart;
      for (let i = 1; i < seg.points.length; i++) {
        const p0 = seg.points[i - 1];
        const p1 = seg.points[i];
        const segPieceLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const pieceStart = acc;
        const pieceEnd = acc + segPieceLen;
        acc = pieceEnd;

        if (pieceEnd < lo || pieceStart > hi) continue;

        const clipLo = Math.max(lo, pieceStart);
        const clipHi = Math.min(hi, pieceEnd);
        const t0 = segPieceLen > 0 ? (clipLo - pieceStart) / segPieceLen : 0;
        const t1 = segPieceLen > 0 ? (clipHi - pieceStart) / segPieceLen : 0;

        const pt0: [number, number] = [
          p0[0] + (p1[0] - p0[0]) * t0,
          p0[1] + (p1[1] - p0[1]) * t0,
        ];
        const pt1: [number, number] = [
          p0[0] + (p1[0] - p0[0]) * t1,
          p0[1] + (p1[1] - p0[1]) * t1,
        ];

        if (
          resultVertices.length === 0 ||
          resultVertices[resultVertices.length - 1].v[0] !== pt0[0] ||
          resultVertices[resultVertices.length - 1].v[1] !== pt0[1]
        ) {
          resultVertices.push({ v: pt0, i: [0, 0], o: [0, 0] });
        }
        resultVertices.push({ v: pt1, i: [0, 0], o: [0, 0] });
      }
    }
    cursor = 0;
  };

  if (!wraps) {
    pushRange(startDist, endDist);
  } else {
    pushRange(startDist, totalLength);
    pushRange(0, endDist);
  }

  return [{ closed: false, vertices: resultVertices }];
}
