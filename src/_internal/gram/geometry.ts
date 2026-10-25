import {
  DiamondMath,
  V2,
  V3,
  V4,
  Mat4,
  fr,
  add3,
  sub3,
  mul3,
  dot3,
  cross3,
  norm3,
  dist2sq3,
  mix3,
  mat4Transpose,
  mulMV,
  ieeeRemainder,
  saturate,
} from "./math";
import {
  DiamondMotion,
  DiamondReferenceHighlights,
  DiamondSparkleAnimation,
  Appearance,
  ReferenceEvent,
} from "./animation";

export const DiamondGeometryConstants = {
  roundingRadius: 0.055,
  crownRoundingRadius: 0.32865,
  girdleRoundingRadius: 0.073114,
  outlineBow: 0.106987,
};

export const DiamondRoundingConstants = { segments: 3, edgeStep: 0.4, radialSteps: 2 };
export const VERTEX_FLOATS = 12;

interface GVertex {
  p: V3;
  n: V3;
  s: V4;
}

export class DiamondGeometry {
  vertices: Float32Array;
  planes: Float32Array;
  constructor(vertices: Float32Array, planes: Float32Array) {
    this.vertices = vertices;
    this.planes = planes;
  }
  get vertexCount() {
    return this.vertices.length / VERTEX_FLOATS;
  }
  get planeCount() {
    return this.planes.length / 4;
  }

  static build(roundingRadius = DiamondGeometryConstants.roundingRadius): DiamondGeometry {
    const girdle: V2[] = [
      [0.70024, 1],
      [1, 0.70024],
      [1, -0.70024],
      [0.70024, -1],
      [-0.70024, -1],
      [-1, -0.70024],
      [-1, 0.70024],
      [-0.70024, 1],
    ];
    const table: V2[] = [
      [0.498552, 0.631807],
      [0.631807, 0.498552],
      [0.631807, -0.498552],
      [0.498552, -0.631807],
      [-0.498552, -0.631807],
      [-0.631807, -0.498552],
      [-0.631807, 0.498552],
      [-0.498552, 0.631807],
    ];
    const sections: { scale: number; y: number; table: boolean }[] = [
      { scale: 0.965, y: 0.583526, table: true },
      { scale: 1, y: 0.571526, table: true },
      { scale: 0.99, y: -0.081806, table: false },
      { scale: 1, y: -0.112806, table: false },
      { scale: 0.978, y: -0.151806, table: false },
      { scale: 0.025, y: -1.07157, table: false },
      { scale: 0.009, y: -1.08757, table: false },
    ];
    const rings: V3[][] = sections.map((s) =>
      Array.from({ length: 8 }, (_, i) => {
        const o = s.table ? table[i] : girdle[i];
        return [fr(o[0] * s.scale), fr(s.y), fr(o[1] * s.scale)] as V3;
      }),
    );
    const planes: V4[] = [];
    function face(points: V3[], kind: number) {
      const p = points.slice();
      let n = norm3(cross3(sub3(p[1], p[0]), sub3(p[2], p[0])));
      const c = p.reduce<V3>((a, b) => add3(a, b), [0, 0, 0]);
      const center = mul3(c, 1 / p.length);
      if (dot3(n, sub3(center, [0, -0.12, 0])) < 0) {
        p.reverse();
        n = mul3(n, -1);
      }
      if (kind !== 3)
        planes.push([
          fr(n[0]),
          fr(n[1]),
          fr(n[2]),
          fr(-dot3([fr(n[0]), fr(n[1]), fr(n[2])], p[0])),
        ]);
    }
    face(rings[0], 0);
    for (let band = 0; band < rings.length - 1; band++) {
      for (let i = 0; i < 8; i++) {
        const next = (i + 1) % 8;
        face(
          [rings[band][i], rings[band + 1][i], rings[band + 1][next], rings[band][next]],
          band === 1 ? 1 : band === 4 ? 2 : 3,
        );
      }
    }
    face(rings[rings.length - 1], 3);
    const verts = DiamondRounding.mesh(planes, roundingRadius);
    const out = new Float32Array(verts.length * VERTEX_FLOATS);
    verts.forEach((v, i) => {
      out.set(
        [v.p[0], v.p[1], v.p[2], 1, v.n[0], v.n[1], v.n[2], 0, v.s[0], v.s[1], v.s[2], v.s[3]],
        i * VERTEX_FLOATS,
      );
    });
    const pl = new Float32Array(planes.length * 4);
    planes.forEach((p, i) => pl.set(p, i * 4));
    return new DiamondGeometry(out, pl);
  }

  position(i: number): V3 {
    const o = i * VERTEX_FLOATS;
    return [this.vertices[o], this.vertices[o + 1], this.vertices[o + 2]];
  }
  normal(i: number): V3 {
    const o = i * VERTEX_FLOATS + 4;
    return [this.vertices[o], this.vertices[o + 1], this.vertices[o + 2]];
  }
}

interface Sample {
  normal: V3;
  material: V3;
}
const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
const edgeMin = (a: number, b: number) => Math.min(a, b);

export const DiamondRounding = {
  mesh(planes: V4[], radius: number, segments = DiamondRoundingConstants.segments): GVertex[] {
    if (!(radius > 0 && radius <= 0.08 && segments >= 3))
      throw new Error("invalid rounding radius");
    const radiusF = fr(radius);
    const normals: V3[] = planes.map((p) => [p[0], p[1], p[2]]);
    const materials: V3[] = planes.map((_, i) =>
      i === 0 ? [1, 0, 0] : i <= 8 ? [0, 1, 0] : [0, 0, 1],
    );
    const dn = normals;
    const offsets = planes.map((p) => p[3] + radiusF);
    const incidenceTolerance = 2e-6;
    const corners: V3[] = [];

    for (let a = 0; a < planes.length - 2; a++)
      for (let b = a + 1; b < planes.length - 1; b++)
        for (let c = b + 1; c < planes.length; c++) {
          const na = dn[a],
            nb = dn[b],
            nc = dn[c];
          const det = dot3(na, cross3(nb, nc));
          if (Math.abs(det) < 1e-8) continue;
          const bc = cross3(nb, nc),
            ca = cross3(nc, na),
            ab = cross3(na, nb);
          const pt: V3 = [
            (-offsets[a] * bc[0] - offsets[b] * ca[0] - offsets[c] * ab[0]) / det,
            (-offsets[a] * bc[1] - offsets[b] * ca[1] - offsets[c] * ab[1]) / det,
            (-offsets[a] * bc[2] - offsets[b] * ca[2] - offsets[c] * ab[2]) / det,
          ];
          let inside = true;
          for (let i = 0; i < planes.length; i++)
            if (!(dot3(dn[i], pt) + offsets[i] < 2e-7)) {
              inside = false;
              break;
            }
          if (!inside) continue;
          if (!corners.some((q) => dist2sq3(q, pt) < 1e-10)) corners.push(pt);
        }

    const sharpPoints: V3[] = [];
    const insetDirections: V3[] = [];
    for (const corner of corners) {
      const incident: number[] = [];
      for (let i = 0; i < planes.length; i++)
        if (Math.abs(dot3(dn[i], corner) + offsets[i]) < incidenceTolerance) incident.push(i);
      let inset: V3 = [0, 0, 0];
      outer: for (let a = 0; a < incident.length - 2; a++)
        for (let b = a + 1; b < incident.length - 1; b++)
          for (let c = b + 1; c < incident.length; c++) {
            const na = dn[incident[a]],
              nb = dn[incident[b]],
              nc = dn[incident[c]];
            const det = dot3(na, cross3(nb, nc));
            if (Math.abs(det) < 1e-8) continue;
            const s = add3(add3(cross3(nb, nc), cross3(nc, na)), cross3(na, nb));
            inset = mul3(s, 1 / det);
            break outer;
          }
      sharpPoints.push([
        fr(corner[0] + radiusF * inset[0]),
        fr(corner[1] + radiusF * inset[1]),
        fr(corner[2] + radiusF * inset[2]),
      ]);
      insetDirections.push([fr(inset[0]), fr(inset[1]), fr(inset[2])]);
    }
    const radiusScale = radiusF / fr(DiamondGeometryConstants.roundingRadius);
    const radii = sharpPoints.map((p) => {
      if (p[1] > 0.4)
        return fr(Math.min(DiamondGeometryConstants.crownRoundingRadius * radiusScale, 0.34));
      if (p[1] > -0.5) return fr(DiamondGeometryConstants.girdleRoundingRadius * radiusScale);
      return radiusF;
    });
    const referencePoints: V3[] = corners.map((c) => [fr(c[0]), fr(c[1]), fr(c[2])]);
    const points: V3[] = sharpPoints.map((s, i) => [
      fr(s[0] - radii[i] * insetDirections[i][0]),
      fr(s[1] - radii[i] * insetDirections[i][1]),
      fr(s[2] - radii[i] * insetDirections[i][2]),
    ]);

    function cyclicOrder(indices: number[], values: V3[], normal: V3): number[] {
      let center: V3 = [0, 0, 0];
      for (const i of indices) center = add3(center, values[i]);
      center = mul3(center, 1 / indices.length);
      const axis: V3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = norm3(cross3(axis, normal)),
        v = cross3(normal, u);
      const ang = (i: number) => {
        const d = sub3(values[i], center);
        return Math.atan2(dot3(d, v), dot3(d, u));
      };
      return indices.slice().sort((x, y) => ang(x) - ang(y));
    }

    const faces: number[][] = planes.map(() => []);
    const incidentFaces: number[][] = corners.map(() => []);
    const edgeFaces = new Map<string, { a: number; b: number; faces: number[] }>();
    for (let face = 0; face < planes.length; face++) {
      const idx: number[] = [];
      for (let i = 0; i < corners.length; i++)
        if (Math.abs(dot3(dn[face], corners[i]) + offsets[face]) < incidenceTolerance) idx.push(i);
      if (idx.length < 3) continue;
      faces[face] = cyclicOrder(idx, referencePoints, normals[face]);
      for (let i = 0; i < faces[face].length; i++) {
        const a = faces[face][i],
          b = faces[face][(i + 1) % idx.length];
        incidentFaces[a].push(face);
        const k = edgeKey(a, b);
        let e = edgeFaces.get(k);
        if (!e) {
          e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] };
          edgeFaces.set(k, e);
        }
        e.faces.push(face);
      }
    }
    if (!(points.length > 0 && [...edgeFaces.values()].every((e) => e.faces.length === 2)))
      throw new Error("Inset must remain a closed convex solid");

    const blendNormal = (a: V3, b: V3, step: number, count: number): V3 => {
      if (step === 0) return a;
      if (step === count) return b;
      const t = step / count;
      return norm3(add3(mul3(a, 1 - t), mul3(b, t)));
    };
    const blend = (a: Sample, b: Sample, step: number, count: number): Sample => {
      const t = step / count;
      return {
        normal: blendNormal(a.normal, b.normal, step, count),
        material: add3(mul3(a.material, 1 - t), mul3(b.material, t)),
      };
    };
    const arcs = new Map<string, Sample[]>();
    for (const e of edgeFaces.values()) {
      const key = edgeKey(e.faces[0], e.faces[1]);
      const ka = edgeMin(e.faces[0], e.faces[1]),
        kb = Math.max(e.faces[0], e.faces[1]);
      const sa: Sample = { normal: normals[ka], material: materials[ka] };
      const sb: Sample = { normal: normals[kb], material: materials[kb] };
      arcs.set(
        key,
        Array.from({ length: segments + 1 }, (_, s) => blend(sa, sb, s, segments)),
      );
    }

    const result: GVertex[] = [];
    const vertex = (p: V3, n: V3, kind: number, sector = 0): GVertex => ({
      p,
      n,
      s: [0, 0, kind, sector],
    });
    const roundedVertex = (index: number, sample: Sample): GVertex => {
      const r = radii[index];
      const v = vertex(
        [
          fr(points[index][0] + r * sample.normal[0]),
          fr(points[index][1] + r * sample.normal[1]),
          fr(points[index][2] + r * sample.normal[2]),
        ],
        sample.normal,
        3,
      );
      v.s[0] = sample.material[0];
      v.s[1] = sample.material[1];
      return v;
    };
    const triangle = (a: GVertex, b: GVertex, c: GVertex) => {
      const cr = cross3(sub3(b.p, a.p), sub3(c.p, a.p));
      const outward = sub3(mul3(add3(add3(a.p, b.p), c.p), 1 / 3), [0, -0.12, 0]);
      if (dot3(cr, outward) > 0) result.push(a, b, c);
      else result.push(a, c, b);
    };
    const quad = (a: GVertex, b: GVertex, c: GVertex, d: GVertex) => {
      triangle(a, b, c);
      triangle(a, c, d);
    };

    const edgeRows = new Map<string, GVertex[][]>();
    const sortedEdges = [...edgeFaces.entries()].sort((x, y) =>
      x[1].a === y[1].a ? x[1].b - y[1].b : x[1].a - y[1].a,
    );
    for (const [key, edge] of sortedEdges) {
      const arc = arcs.get(edgeKey(edge.faces[0], edge.faces[1]))!;
      const steps = Math.max(
        1,
        Math.ceil(
          Math.hypot(...sub3(sharpPoints[edge.a], sharpPoints[edge.b])) /
            DiamondRoundingConstants.edgeStep,
        ),
      );
      const rows: GVertex[][] = [];
      for (let row = 0; row <= steps; row++) {
        if (row === 0) {
          rows.push(arc.map((s) => roundedVertex(edge.a, s)));
          continue;
        }
        if (row === steps) {
          rows.push(arc.map((s) => roundedVertex(edge.b, s)));
          continue;
        }
        const t = row / steps;
        const smooth = t * t * (3 - 2 * t);
        const r = radii[edge.a] + (radii[edge.b] - radii[edge.a]) * smooth;
        const dr = (radii[edge.b] - radii[edge.a]) * 6 * t * (1 - t);
        const inset = mix3(insetDirections[edge.a], insetDirections[edge.b], t);
        const center = sub3(mix3(sharpPoints[edge.a], sharpPoints[edge.b], t), mul3(inset, r));
        const tangent = sub3(
          sub3(
            sub3(sharpPoints[edge.b], sharpPoints[edge.a]),
            mul3(sub3(insetDirections[edge.b], insetDirections[edge.a]), r),
          ),
          mul3(inset, dr),
        );
        const axis = norm3(cross3(arc[0].normal, arc[arc.length - 1].normal));
        rows.push(
          arc.map((sample, index) => {
            const along = add3(tangent, mul3(sample.normal, dr));
            const across = cross3(axis, sample.normal);
            let normal = norm3(cross3(along, across));
            if (dot3(normal, sample.normal) < 0) normal = mul3(normal, -1);
            if (index === 0 || index === segments) normal = sample.normal;
            const v = vertex(add3(center, mul3(sample.normal, r)), normal, 3);
            v.s[0] = sample.material[0];
            v.s[1] = sample.material[1];
            return v;
          }),
        );
      }
      edgeRows.set(key, rows);
      for (let row = 0; row < steps; row++)
        for (let i = 0; i < segments; i++)
          quad(rows[row][i], rows[row + 1][i], rows[row + 1][i + 1], rows[row][i + 1]);
    }

    for (let face = 0; face < faces.length; face++) {
      if (faces[face].length < 3) continue;
      const n = normals[face];
      const kind = face === 0 ? 0 : face <= 8 ? 1 : 2;
      const rim: GVertex[] = [];
      for (let i = 0; i < faces[face].length; i++) {
        const a = faces[face][i],
          b = faces[face][(i + 1) % faces[face].length];
        const k = edgeKey(a, b);
        const adjacent = edgeFaces.get(k)!.faces;
        const arcIndex = face === Math.min(adjacent[0], adjacent[1]) ? 0 : segments;
        const rows = edgeRows.get(k)!;
        const ordered = a < b ? rows : rows.slice().reverse();
        for (const row of ordered.slice(0, -1)) {
          const p = row[arcIndex].p;
          rim.push(vertex([p[0], p[1], p[2]], n, kind, (face - 1) % 8));
        }
      }
      let c: V3 = [0, 0, 0];
      for (const r of rim) c = add3(c, r.p);
      c = mul3(c, 1 / rim.length);
      const middle = vertex([fr(c[0]), fr(c[1]), fr(c[2])], n, kind);
      for (let i = 0; i < rim.length; i++) triangle(middle, rim[i], rim[(i + 1) % rim.length]);
    }

    const radialSteps = DiamondRoundingConstants.radialSteps;
    for (let corner = 0; corner < points.length; corner++) {
      const incident = incidentFaces[corner];
      if (incident.length < 3) continue;
      let sum: V3 = [0, 0, 0];
      let msum: V3 = [0, 0, 0];
      for (const f of incident) {
        sum = add3(sum, normals[f]);
        msum = add3(msum, materials[f]);
      }
      const centerSample: Sample = {
        normal: norm3(sum),
        material: mul3(msum, 1 / incident.length),
      };
      const ordered = cyclicOrder(incident, normals, centerSample.normal);
      const middle = roundedVertex(corner, centerSample);
      for (let i = 0; i < ordered.length; i++) {
        const a = ordered[i],
          b = ordered[(i + 1) % ordered.length];
        const samples = arcs.get(edgeKey(a, b))!;
        const arc = a < b ? samples : samples.slice().reverse();
        for (let j = 0; j < segments; j++) {
          const sample = (side: number, row: number) =>
            roundedVertex(corner, blend(centerSample, arc[j + side], row, radialSteps));
          triangle(middle, sample(0, 1), sample(1, 1));
          for (let row = 1; row < radialSteps; row++)
            quad(sample(0, row), sample(1, row), sample(1, row + 1), sample(0, row + 1));
        }
      }
    }

    const bow = fr(DiamondGeometryConstants.outlineBow);
    return result.map((v) => {
      const x = v.p[0],
        z = v.p[2];
      const a = 1 - bow * z * z,
        b = 1 - bow * x * x,
        c = -2 * bow * x * z;
      const det = a * b - c * c;
      const n = norm3([(b * v.n[0] - c * v.n[2]) / det, v.n[1], (a * v.n[2] - c * v.n[0]) / det]);
      return { p: [fr(x * a), v.p[1], fr(z * b)] as V3, n, s: v.s };
    });
  },
};

export interface Anchor {
  position: V4;
  normal: V4;
}
export interface HighlightInstance {
  position: V4;
  facing: V4;
  axisX: V4;
  axisY: V4;
}

interface Outline {
  vertices: V2[];
  incoming: V2[];
  outgoing: V2[];
}
function outlineSample(o: Outline, i: number, t: number): V2 {
  const j = (i + 1) % o.vertices.length;
  const a = o.vertices[i],
    b: V2 = [a[0] + o.outgoing[i][0], a[1] + o.outgoing[i][1]];
  const d = o.vertices[j],
    c: V2 = [d[0] + o.incoming[j][0], d[1] + o.incoming[j][1]];
  const s = 1 - t;
  return [
    a[0] * (s * s * s) + b[0] * (3 * s * s * t) + c[0] * (3 * s * t * t) + d[0] * (t * t * t),
    a[1] * (s * s * s) + b[1] * (3 * s * s * t) + c[1] * (3 * s * t * t) + d[1] * (t * t * t),
  ];
}
const O = (v: number[][], i: number[][], o: number[][]): Outline => ({
  vertices: v as V2[],
  incoming: i as V2[],
  outgoing: o as V2[],
});

const coreWide = O(
  [
    [1.3, -80.9],
    [17.6, -39.5],
    [38.9, -20.7],
    [80.3, -3.1],
    [38.9, 15.7],
    [17.6, 37],
    [0, 80.9],
    [-17.6, 37],
    [-38.9, 15.7],
    [-80.3, -3.1],
    [-38.9, -20.7],
    [-16.3, -40.8],
  ],
  [
    [-6.3, 0],
    [-6.3, -15.1],
    [-11.3, -3.8],
    [0, -6.3],
    [13.8, -5],
    [5, -11.3],
    [6.3, 0],
    [6.3, 16.3],
    [11.3, 3.8],
    [0, 7.5],
    [-15.1, 5],
    [-5, 11.3],
  ],
  [
    [5, 0],
    [3.8, 10],
    [13.8, 5],
    [0, 7.5],
    [-11.3, 3.8],
    [-6.3, 16.3],
    [-6.3, 0],
    [-3.8, -11.3],
    [-16.3, -6.3],
    [0, -6.3],
    [11.3, -3.8],
    [6.3, -16.3],
  ],
);
const coreNarrow = O(
  [
    [1.3, -80.9],
    [9, -23],
    [20.8, -12.6],
    [80.3, -3.1],
    [20.8, 7.6],
    [9, 19.4],
    [0, 80.9],
    [-10.5, 19.4],
    [-22.3, 7.6],
    [-80.3, -3.1],
    [-22.3, -12.6],
    [-9.8, -23.7],
  ],
  [
    [-6.3, 0],
    [-3.5, -8.4],
    [-6.3, -2.1],
    [0, -6.3],
    [7.7, -2.8],
    [2.8, -6.3],
    [6.3, 0],
    [3.5, 9.1],
    [6.3, 2.1],
    [0, 7.5],
    [-8.4, 2.8],
    [-2.8, 6.3],
  ],
  [
    [5, 0],
    [2.1, 5.6],
    [7.7, 2.8],
    [0, 7.5],
    [-6.3, 2.1],
    [-3.5, 9.1],
    [-6.3, 0],
    [-2.1, -6.3],
    [-9.1, -3.5],
    [0, -6.3],
    [6.3, -2.1],
    [3.5, -9.1],
  ],
);
const haloWide = O(
  [
    [1.8, -113.5],
    [24.6, -55.4],
    [54.6, -29],
    [112.7, -4.4],
    [54.6, 22],
    [24.6, 51.9],
    [0, 113.5],
    [-24.6, 51.9],
    [-54.6, 22],
    [-112.7, -4.4],
    [-54.6, -29],
    [-22.9, -57.2],
  ],
  [
    [-8.8, 0],
    [-8.8, -21.1],
    [-15.8, -5.3],
    [0, -8.8],
    [19.4, -7],
    [7, -15.8],
    [8.8, 0],
    [8.8, 22.9],
    [15.8, 5.3],
    [0, 10.6],
    [-21.1, 7],
    [-7, 15.8],
  ],
  [
    [7, 0],
    [5.3, 14.1],
    [19.4, 7],
    [0, 10.6],
    [-15.8, 5.3],
    [-8.8, 22.9],
    [-8.8, 0],
    [-5.3, -15.8],
    [-22.9, -8.8],
    [0, -8.8],
    [15.8, -5.3],
    [8.8, -22.9],
  ],
);
const haloNarrow = O(
  [
    [1.8, -113.5],
    [12.9, -32],
    [29.5, -17.3],
    [112.7, -4.4],
    [29.5, 11],
    [12.9, 27.7],
    [0, 113.5],
    [-14.5, 27.7],
    [-31.1, 11],
    [-112.7, -4.4],
    [-31.1, -17.3],
    [-13.5, -32.9],
  ],
  [
    [-8.8, 0],
    [-4.9, -11.7],
    [-8.8, -2.9],
    [0, -8.8],
    [10.7, -3.9],
    [3.9, -8.8],
    [8.8, 0],
    [4.9, 12.7],
    [8.8, 2.9],
    [0, 10.6],
    [-11.7, 3.9],
    [-3.9, 8.8],
  ],
  [
    [7, 0],
    [2.9, 7.8],
    [10.7, 3.9],
    [0, 10.6],
    [-8.8, 2.9],
    [-4.9, 12.7],
    [-8.8, 0],
    [-2.9, -8.8],
    [-12.7, -4.9],
    [0, -8.8],
    [8.8, -2.9],
    [4.9, -12.7],
  ],
);
const circle = O(
  [
    [108.5, 0],
    [0, 108.5],
    [-108.5, 0],
    [0, -108.5],
  ],
  [
    [0, -59.9],
    [59.9, 0],
    [0, 59.9],
    [-59.9, 0],
  ],
  [
    [0, 59.9],
    [-59.9, 0],
    [0, -59.9],
    [59.9, 0],
  ],
);
const smallCore = O(
  [
    [0, -53.2],
    [53.2, 0],
    [0, 53.2],
    [-53.2, 0],
  ],
  [
    [-3.1, 50.4],
    [-50.8, -2.9],
    [2.1, -49.7],
    [50.1, 3.5],
  ],
  [
    [2.5, 50.2],
    [-50.8, 3.5],
    [-3.1, -49.7],
    [50.1, -2.7],
  ],
);
const streak = O(
  [
    [-7.2, -261],
    [349.5, -86.1],
    [2.5, 89.6],
    [-354.2, -85.3],
  ],
  [
    [-194.3, 0.2],
    [-2.7, -96.8],
    [194.3, -0.2],
    [2.7, 96.8],
  ],
  [
    [194.3, -0.2],
    [2.7, 96.8],
    [-194.3, 0.2],
    [-2.7, -96.8],
  ],
);

export const SPARKLE_FLOATS = 8;

function tessellate(wide: Outline, narrow: Outline, layer: number): number[] {
  const out: number[] = [];
  for (let segment = 0; segment < wide.vertices.length; segment++)
    for (let step = 0; step < 16; step++) {
      const t0 = step / 16,
        t1 = (step + 1) / 16;
      for (const t of [-1, t0, t1]) {
        const a: V2 = t < 0 ? [0, 0] : outlineSample(wide, segment, t);
        const b: V2 = t < 0 ? [0, 0] : outlineSample(narrow, segment, t);
        out.push(a[0], a[1], b[0], b[1], layer, 0, 0, 0);
      }
    }
  return out;
}
const scaleOutline = (o: Outline, k: number): Outline => ({
  vertices: o.vertices.map((v) => [v[0] * k, v[1] * k] as V2),
  incoming: o.incoming.map((v) => [v[0] * k, v[1] * k] as V2),
  outgoing: o.outgoing.map((v) => [v[0] * k, v[1] * k] as V2),
});

export class DiamondSparkleGeometry {
  main: Float32Array;
  small: Float32Array;
  streakVertices: Float32Array;
  constructor() {
    const centered: Outline = {
      vertices: streak.vertices.map((v) => [v[0] + 3.2, v[1] + 84.1] as V2),
      incoming: streak.incoming,
      outgoing: streak.outgoing,
    };
    this.streakVertices = new Float32Array(tessellate(centered, centered, 5));
    this.main = new Float32Array([
      ...tessellate(circle, circle, 0),
      ...tessellate(haloWide, haloNarrow, 1),
      ...tessellate(coreWide, coreNarrow, 2),
    ]);
    const smallCircle = scaleOutline(circle, 256 / 108.5);
    this.small = new Float32Array([
      ...tessellate(smallCircle, smallCircle, 3),
      ...tessellate(smallCore, smallCore, 4),
    ]);
  }
  get mainCount() {
    return this.main.length / SPARKLE_FLOATS;
  }
  get smallCount() {
    return this.small.length / SPARKLE_FLOATS;
  }
  get streakCount() {
    return this.streakVertices.length / SPARKLE_FLOATS;
  }

  static intersect(geometry: DiamondGeometry, origin: V3, direction: V3): Anchor | null {
    let nearest = Infinity;
    let result: Anchor | null = null;
    const v = geometry.vertices;
    for (let i = 0; i < geometry.vertexCount; i += 3) {
      const a = geometry.position(i),
        b = geometry.position(i + 1),
        c = geometry.position(i + 2);
      const e1 = sub3(b, a),
        e2 = sub3(c, a);
      const cr = cross3(direction, e2);
      const det = dot3(e1, cr);
      if (Math.abs(det) < 1e-10) continue;
      const off = sub3(origin, a);
      const u = dot3(off, cr) / det;
      const q = cross3(off, e1);
      const vv = dot3(direction, q) / det;
      const distance = dot3(e2, q) / det;
      if (!(u >= -1e-5 && vv >= -1e-5 && u + vv <= 1.00001 && distance > 0 && distance < nearest))
        continue;
      nearest = distance;
      const na = geometry.normal(i),
        nb = geometry.normal(i + 1),
        nc = geometry.normal(i + 2);
      const normal = norm3(add3(add3(mul3(na, 1 - u - vv), mul3(nb, u)), mul3(nc, vv)));
      const p = add3(origin, mul3(direction, distance));
      result = { position: [p[0], p[1], p[2], 1], normal: [normal[0], normal[1], normal[2], 0] };
    }
    void v;
    return result;
  }

  static anchors(geometry: DiamondGeometry): Anchor[] {
    const reference = DiamondMath.rotation(DiamondMotion.referencePitch, 0);
    const projected: V2[] = [];
    for (let i = 0; i < geometry.vertexCount; i++) {
      const p = geometry.position(i);
      projected.push(DiamondMath.cameraPoint(mulMV(reference, [p[0], p[1], p[2], 1])));
    }
    const halfWidth = projected.reduce((m, p) => Math.max(m, Math.abs(p[0])), 0);
    const top = projected.reduce((m, p) => Math.max(m, p[1]), -Infinity);
    const refT = mat4Transpose(reference);
    return Array.from({ length: 8 }, (_, instance) => {
      if (instance === 0) {
        const scale = halfWidth / ((447.9 * 0.75) / 2);
        const ray = DiamondMath.cameraRay([42.375 * scale, top - 105.075 * scale]);
        const p = mulMV(refT, ray.origin),
          d = mulMV(refT, ray.direction);
        const hit = DiamondSparkleGeometry.intersect(
          geometry,
          [p[0], p[1], p[2]],
          [d[0], d[1], d[2]],
        );
        if (!hit) throw new Error("The branded sparkle must lie on the front facet");
        return hit;
      }
      const angle = (instance * Math.PI) / 4 + Math.PI / 8;
      const height = instance % 3 === 0 ? 0.56 : instance % 3 === 1 ? -0.02 : -0.54;
      const hit = DiamondSparkleGeometry.intersect(
        geometry,
        [0, height, 0],
        [Math.sin(angle), 0, Math.cos(angle)],
      );
      if (!hit) throw new Error("Sparkle anchor must intersect the diamond");
      return hit;
    });
  }
}

export class SparkleReference {
  anchors: Anchor[];
  private events: ReferenceEvent[];
  private planes: V4[];
  private sourceScale: number;
  private top: number;
  constructor(
    private geometry: DiamondGeometry,
    private appearance: Appearance = Appearance.blue,
  ) {
    this.events = DiamondReferenceHighlights.eventsFor(appearance);
    const model = DiamondMath.rotation(DiamondMotion.referencePitch, 0);
    const projected: V2[] = [];
    for (let i = 0; i < geometry.vertexCount; i++) {
      const p = geometry.position(i);
      projected.push(DiamondMath.cameraPoint(mulMV(model, [p[0], p[1], p[2], 1])));
    }
    const scale = projected.reduce((m, p) => Math.max(m, Math.abs(p[0])), 0) / ((447.9 * 0.75) / 2);
    const top = projected.reduce((m, p) => Math.max(m, p[1]), -Infinity);
    this.sourceScale = scale;
    this.top = top;
    this.planes = [];
    for (let i = 0; i < geometry.planeCount; i++)
      this.planes.push([
        geometry.planes[i * 4],
        geometry.planes[i * 4 + 1],
        geometry.planes[i * 4 + 2],
        geometry.planes[i * 4 + 3],
      ]);
    this.anchors = this.events.map((event) => {
      const inverse = mat4Transpose(
        DiamondMath.rotation(
          DiamondMotion.referencePitch,
          DiamondMotion.referenceYaw(
            (event.frame + 2) * (appearance === Appearance.white ? 3 / 121 : 1 / 60),
            appearance,
          ),
        ),
      );
      const x = (event.position[0] - 256) * scale;
      const y = top + (141.85 - event.position[1]) * scale;
      const ray = DiamondMath.cameraRay([x, y]);
      const p = mulMV(inverse, ray.origin),
        d = mulMV(inverse, ray.direction);
      const direction: V3 = [d[0], d[1], d[2]];
      const hit = DiamondSparkleGeometry.intersect(geometry, [p[0], p[1], p[2]], direction);
      if (!hit) throw new Error(`Reference flare must lie on the diamond: ${event.frame}`);
      return {
        position: [
          hit.position[0] - direction[0] * 0.003,
          hit.position[1] - direction[1] * 0.003,
          hit.position[2] - direction[2] * 0.003,
          1,
        ] as V4,
        normal: [-d[0], -d[1], -d[2], 0] as V4,
      };
    });
  }

  smallInstances(time: number): HighlightInstance[] {
    const result: HighlightInstance[] = [];
    this.events.forEach((event, i) => {
      const scale = DiamondReferenceHighlights.eventScale(event, time, this.appearance);
      if (!(scale > 0)) return;
      const a = this.anchors[i];
      result.push({
        position: a.position,
        facing: [a.normal[0], a.normal[1], a.normal[2], 1],
        axisX: [scale, 0, 0, 0],
        axisY: [0, 0, 0, 0],
      });
    });
    return result;
  }

  streakInstances(time: number): HighlightInstance[] {
    const inverse = mat4Transpose(
      DiamondMath.rotation(
        DiamondMotion.referencePitch,
        DiamondMotion.referenceYaw(time, this.appearance),
      ),
    );
    const view = mulMV(inverse, [0, 0, 1, 0]);
    const inverseT = mat4Transpose(inverse);
    return DiamondReferenceHighlights.streaks(time, this.appearance).map((s) => {
      const cameraPoint: V2 = [
        (s.center[0] - 256) * this.sourceScale,
        this.top + (141.85 - s.center[1]) * this.sourceScale,
      ];
      const ray = DiamondMath.cameraRay(cameraPoint);
      const origin = mulMV(inverse, ray.origin);
      const direction = mulMV(inverse, ray.direction);
      let near = 0,
        far = 12;
      for (const plane of this.planes) {
        const n: V4 = [plane[0], plane[1], plane[2], 0];
        const distance =
          n[0] * origin[0] + n[1] * origin[1] + n[2] * origin[2] + n[3] * origin[3] + plane[3];
        const denominator =
          n[0] * direction[0] + n[1] * direction[1] + n[2] * direction[2] + n[3] * direction[3];
        if (Math.abs(denominator) < 0.000001) {
          if (distance > 0) far = -1;
        } else if (denominator < 0) near = Math.max(near, -distance / denominator);
        else far = Math.min(far, -distance / denominator);
      }
      const distance =
        near <= far ? Math.max(0, near - 0.003) : (0.5 - ray.origin[2]) / ray.direction[2];
      const position: V4 = [
        origin[0] + direction[0] * distance,
        origin[1] + direction[1] * distance,
        origin[2] + direction[2] * distance,
        origin[3] + direction[3] * distance,
      ];
      const depthScale = DiamondMath.cameraW(mulMV(inverseT, position)[2]);
      const axis = (a: V2): V4 =>
        mulMV(inverse, [
          a[0] * this.sourceScale * depthScale,
          -a[1] * this.sourceScale * depthScale,
          0,
          0,
        ]);
      return {
        position,
        facing: [view[0], view[1], view[2], s.opacity] as V4,
        axisX: axis(s.axisX),
        axisY: axis(s.axisY),
      };
    });
  }
}

export class DiamondSilhouette {
  widths: Float32Array;
  constructor(widths: Float32Array) {
    this.widths = widths;
  }
  static from(geometry: DiamondGeometry): DiamondSilhouette {
    const seen = new Set<string>();
    const pts: V4[] = [];
    for (let i = 0; i < geometry.vertexCount; i++) {
      const p = geometry.position(i);
      const k = `${p[0]},${p[1]},${p[2]}`;
      if (!seen.has(k)) {
        seen.add(k);
        pts.push([p[0], p[1], p[2], 1]);
      }
    }
    const widths = new Float32Array(91);
    for (let i = 0; i <= 90; i++) {
      const model = DiamondMath.rotation(DiamondMotion.referencePitch, (i * Math.PI) / 360);
      let left = Infinity,
        right = -Infinity;
      for (const p of pts) {
        const x = DiamondMath.cameraPoint(mulMV(model, p))[0];
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
      widths[i] = (right - left) / 2;
    }
    return new DiamondSilhouette(widths);
  }
  horizontalScale(yaw: number, pitch: number): number {
    const w = this.widths;
    const quadrant = Math.abs(ieeeRemainder(yaw, Math.PI / 2));
    const sample = Math.min(90, (quadrant * 360) / Math.PI);
    const i = Math.min(89, Math.trunc(sample)),
      t = sample - i;
    const a = w[i],
      b = w[i + 1];
    const da = i === 0 ? 0 : (b - w[i - 1]) / 2;
    const db = i === 89 ? 0 : (w[i + 2] - a) / 2;
    const width = a + t * (da + t * (3 * (b - a) - 2 * da - db + t * (2 * (a - b) + da + db)));
    const turn = Math.sin(2 * quadrant);
    const targetWidth = w[0] * (1 - 0.035 * turn * turn);
    const tilt = Math.min(
      1,
      Math.max(0, (Math.abs(Math.sin(pitch)) - Math.sin(0.25)) / (Math.sin(0.96) - Math.sin(0.25))),
    );
    const reveal = tilt * tilt * (3 - 2 * tilt);
    return 1 + (targetWidth / width - 1) * (1 - reveal);
  }
}

export class DiamondRenderData {
  geometry: DiamondGeometry;
  sparkles: DiamondSparkleGeometry;
  anchors: Anchor[];
  silhouette: DiamondSilhouette;
  facetProjection: V4;
  lensVertices: V4[];
  private static shared: DiamondRenderData | null = null;
  static get(): DiamondRenderData {
    return (DiamondRenderData.shared ??= new DiamondRenderData());
  }
  private constructor() {
    const geometry = DiamondGeometry.build();
    this.geometry = geometry;
    this.sparkles = new DiamondSparkleGeometry();
    this.anchors = DiamondSparkleGeometry.anchors(geometry);
    this.silhouette = DiamondSilhouette.from(geometry);
    const model = DiamondMath.rotation(DiamondMotion.referencePitch, 0);
    let width = 0,
      top = -Infinity;
    for (let i = 0; i < geometry.vertexCount; i++) {
      const p = geometry.position(i);
      const c = DiamondMath.cameraPoint(mulMV(model, [p[0], p[1], p[2], 1]));
      width = Math.max(width, Math.abs(c[0]));
      top = Math.max(top, c[1]);
    }
    this.facetProjection = [
      Math.cos(DiamondMotion.referencePitch),
      Math.sin(DiamondMotion.referencePitch),
      223.95 / width,
      top,
    ];
    const seen = new Set<string>();
    this.lensVertices = [];
    for (let i = 0; i < geometry.vertexCount; i++) {
      const p = geometry.position(i);
      const key = `${Math.round(p[0] * 40)},${Math.round(p[1] * 40)},${Math.round(p[2] * 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        this.lensVertices.push([p[0], p[1], p[2], 1]);
      }
    }
  }
}

void saturate;
