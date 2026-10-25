import { DiamondMath, Mat4, V2, V4, mulMV } from "./math";
import {
  Appearance,
  DiamondEntrance,
  DiamondLightAnimation,
  DiamondMotion,
  DiamondReferenceHighlights,
  DiamondSparkleAnimation,
  DiamondStarBurst,
} from "./animation";
import {
  DiamondRenderData,
  SparkleReference,
  HighlightInstance,
  VERTEX_FLOATS,
  SPARKLE_FLOATS,
} from "./geometry";
import { DiamondStyle } from "./style";
import {
  STAR_VERTEX,
  STAR_FRAGMENT,
  STONE_VERTEX,
  STONE_FRAGMENT,
  LENS_FRAGMENT,
  SPARKLE_VERTEX,
  HIGHLIGHT_VERTEX,
  SPARKLE_FRAGMENT,
} from "./shaders";

export interface RefractionSource {
  image: TexImageSource;
  version?: number;
  rect: { x: number; y: number; width: number; height: number };
  uv?: V4;
  preservesColors?: boolean;
}
export interface RefractionGeometry {
  center: { x: number; y: number };
  hull: { x: number; y: number }[];
  strength: number;
  rotation: number;
}

interface Lens {
  uniforms: Float32Array;
  edges: Float32Array;
  hull: V2[];
}

const BINDINGS: Record<string, number> = {
  Uniforms: 0,
  PlaneBlock: 1,
  LensBlock: 2,
  EdgeBlock: 3,
  AnchorBlock: 4,
  StarUniforms: 5,
};

export interface EncodeParams {
  size: { width: number; height: number }; // pixels
  time: number;
  starBursts: DiamondStarBurst[];
  starOffset: { x: number; y: number };
  motion: DiamondMotion;
  style: DiamondStyle;
  grow: number;
  pixelsPerPoint: number;
  reduceMotion: boolean;
  lightBackground: boolean;
  refractionSource: RefractionSource | null;
  refractionStrength: number;
  highlightBoost: number;
  refractionUpdated?: ((geometry: RefractionGeometry | null) => void) | null;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    throw new Error(`GramDiamond shader "${label}" failed to compile:\n${log}`);
  }
  return s;
}

function makeProgram(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
  label: string,
): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, `${label}.vertex`));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, `${label}.fragment`));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(`GramDiamond program "${label}" failed to link:\n${gl.getProgramInfoLog(p)}`);
  for (const [name, binding] of Object.entries(BINDINGS)) {
    const idx = gl.getUniformBlockIndex(p, name);
    if (idx !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, idx, binding);
  }
  return p;
}

export class DiamondRenderer {
  private data = DiamondRenderData.get();
  private geometry = this.data.geometry;
  private programs: {
    stars?: WebGLProgram;
    stone?: WebGLProgram;
    lens?: WebGLProgram;
    sparkle?: WebGLProgram;
    highlight?: WebGLProgram;
  } = {};
  private vbStone: WebGLBuffer;
  private vbMain: WebGLBuffer;
  private vbSmall: WebGLBuffer;
  private vbStreak: WebGLBuffer;
  private vbInstances: WebGLBuffer;
  private ubo: Record<string, WebGLBuffer> = {};
  private vaoStone: WebGLVertexArrayObject;
  private vaoMain: WebGLVertexArrayObject;
  private vaoSmall: WebGLVertexArrayObject;
  private vaoSmallHighlight: WebGLVertexArrayObject;
  private vaoStreakHighlight: WebGLVertexArrayObject;
  private vaoEmpty: WebGLVertexArrayObject;
  private referenceHighlights: SparkleReference | null = null;
  private whiteReferenceHighlights: SparkleReference | null = null;
  private textures = new Map<
    TexImageSource,
    { tex: WebGLTexture; version: number | undefined; premultiplied: boolean }
  >();
  private uniformData = new Float32Array(116);
  private starData = new Float32Array(32);

  constructor(private gl: WebGL2RenderingContext) {
    const mk = () => gl.createBuffer()!;
    this.vbStone = mk();
    this.vbMain = mk();
    this.vbSmall = mk();
    this.vbStreak = mk();
    this.vbInstances = mk();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbStone);
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.vertices, gl.STATIC_DRAW);
    const sp = this.data.sparkles;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbMain);
    gl.bufferData(gl.ARRAY_BUFFER, sp.main, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbSmall);
    gl.bufferData(gl.ARRAY_BUFFER, sp.small, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbStreak);
    gl.bufferData(gl.ARRAY_BUFFER, sp.streakVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbInstances);
    gl.bufferData(gl.ARRAY_BUFFER, 16 * 4 * 8, gl.DYNAMIC_DRAW);

    const uboSizes: Record<string, number> = {
      Uniforms: 116 * 4,
      PlaneBlock: 17 * 16,
      LensBlock: 5 * 16,
      EdgeBlock: 128 * 16,
      AnchorBlock: 16 * 16,
      StarUniforms: 32 * 4,
    };
    for (const [name, size] of Object.entries(uboSizes)) {
      const b = mk();
      gl.bindBuffer(gl.UNIFORM_BUFFER, b);
      gl.bufferData(gl.UNIFORM_BUFFER, size, gl.DYNAMIC_DRAW);
      this.ubo[name] = b;
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo.PlaneBlock);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.geometry.planes);
    const anchors = new Float32Array(16 * 4);
    this.data.anchors.forEach((a, i) => {
      anchors.set(a.position, i * 8);
      anchors.set(a.normal, i * 8 + 4);
    });
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo.AnchorBlock);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, anchors);

    const vao = () => gl.createVertexArray()!;
    this.vaoStone = vao();
    gl.bindVertexArray(this.vaoStone);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbStone);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, VERTEX_FLOATS * 4, i * 16);
    }
    const sparkleVao = (buffer: WebGLBuffer, instanced: boolean) => {
      const v = vao();
      gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (let i = 0; i < 2; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, 4, gl.FLOAT, false, SPARKLE_FLOATS * 4, i * 16);
      }
      if (instanced) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbInstances);
        for (let i = 0; i < 4; i++) {
          gl.enableVertexAttribArray(2 + i);
          gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, 64, i * 16);
          gl.vertexAttribDivisor(2 + i, 1);
        }
      }
      return v;
    };
    this.vaoMain = sparkleVao(this.vbMain, false);
    this.vaoSmall = sparkleVao(this.vbSmall, false);
    this.vaoSmallHighlight = sparkleVao(this.vbSmall, true);
    this.vaoStreakHighlight = sparkleVao(this.vbStreak, true);
    this.vaoEmpty = vao();
    gl.bindVertexArray(null);

    this.programs.stone = makeProgram(gl, STONE_VERTEX, STONE_FRAGMENT, "stone");
    this.programs.sparkle = makeProgram(gl, SPARKLE_VERTEX, SPARKLE_FRAGMENT, "sparkle");
    this.programs.highlight = makeProgram(gl, HIGHLIGHT_VERTEX, SPARKLE_FRAGMENT, "highlight");
  }

  private get stars() {
    return (this.programs.stars ??= makeProgram(this.gl, STAR_VERTEX, STAR_FRAGMENT, "stars"));
  }
  private get lensProgram() {
    return (this.programs.lens ??= makeProgram(this.gl, STONE_VERTEX, LENS_FRAGMENT, "lens"));
  }

  dispose() {
    const gl = this.gl;
    [
      this.vbStone,
      this.vbMain,
      this.vbSmall,
      this.vbStreak,
      this.vbInstances,
      ...Object.values(this.ubo),
    ].forEach((b) => gl.deleteBuffer(b));
    for (const t of this.textures.values()) gl.deleteTexture(t.tex);
    Object.values(this.programs).forEach((p) => p && gl.deleteProgram(p));
    [
      this.vaoStone,
      this.vaoMain,
      this.vaoSmall,
      this.vaoSmallHighlight,
      this.vaoStreakHighlight,
      this.vaoEmpty,
    ].forEach((v) => gl.deleteVertexArray(v));
  }

  private texture(source: RefractionSource): WebGLTexture {
    const gl = this.gl;
    let entry = this.textures.get(source.image);
    const premultiplied = !!source.preservesColors;
    if (!entry) {
      entry = { tex: gl.createTexture()!, version: undefined, premultiplied };
      this.textures.set(source.image, entry);
    }
    if (
      entry.version !== source.version ||
      entry.premultiplied !== premultiplied ||
      entry.version === undefined
    ) {
      gl.bindTexture(gl.TEXTURE_2D, entry.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplied);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      entry.version = source.version ?? 0;
      entry.premultiplied = premultiplied;
    }
    return entry.tex;
  }

  private lens(
    source: RefractionSource | null,
    strength: number,
    yaw: number,
    u: Float32Array,
    pixelsPerPoint: number,
    lightBackground: boolean,
    vw: number,
    vh: number,
  ): Lens | null {
    if (
      !source ||
      !(strength > 0.001) ||
      !(source.rect.width > 0 && source.rect.height > 0) ||
      !(pixelsPerPoint > 0)
    )
      return null;
    const halfX = vw / (2 * pixelsPerPoint),
      halfY = vh / (2 * pixelsPerPoint);
    const projection = u.subarray(16, 32) as unknown as Mat4;
    const model = u.subarray(0, 16) as unknown as Mat4;
    const transform = (v: V4): V4 => mulMV(projection, mulMV(model, v));
    const project = (v: V4): V2 => {
      const p = transform(v);
      return [(p[0] / p[3]) * halfX, (-p[1] / p[3]) * halfY];
    };
    const center = project([0, 0, 0, 1]);
    let points: V2[] = this.data.lensVertices.map((v) => {
      const p = project(v);
      return [center[0] + (p[0] - center[0]) * 0.96, center[1] + (p[1] - center[1]) * 0.96] as V2;
    });
    const radius = points.reduce(
      (m, p) => Math.max(m, Math.hypot(p[0] - center[0], p[1] - center[1])),
      0,
    );
    points.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
    const cross = (o: V2, a: V2, b: V2) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: V2[] = [],
      upper: V2[] = [];
    for (const p of points) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
        lower.pop();
      lower.push(p);
    }
    for (const p of [...points].reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
        upper.pop();
      upper.push(p);
    }
    let hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    if (hull.length < 3) return null;
    if (hull.length > 128) {
      const h = hull;
      hull = Array.from({ length: 128 }, (_, i) => h[Math.floor((i * h.length) / 128)]);
    }
    const edges = new Float32Array(128 * 4);
    hull.forEach((a, i) => {
      const b = hull[(i + 1) % hull.length];
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const len = Math.max(Math.hypot(dx, dy), 0.0001);
      const nx = -dy / len,
        ny = dx / len;
      edges.set([nx, ny, -(nx * a[0] + ny * a[1]), 0], i * 4);
    });
    const uv = source.uv ?? [0, 0, 1, 1];
    const lu = new Float32Array([
      source.rect.x,
      source.rect.y,
      source.rect.width,
      source.rect.height,
      uv[0],
      uv[1],
      uv[2],
      uv[3],
      vw * 0.5,
      vh * 0.5,
      pixelsPerPoint,
      hull.length,
      Math.min(1, strength),
      yaw,
      radius,
      lightBackground ? 1 : 0,
      center[0],
      center[1],
      source.preservesColors ? 1 : 0,
      0,
    ]);
    return { uniforms: lu, edges, hull };
  }

  private buildUniforms(p: EncodeParams): Float32Array {
    const { size, time, motion, style, grow, pixelsPerPoint, reduceMotion, highlightBoost } = p;
    const model = DiamondMath.rotation(motion.pitch, motion.renderedYaw);
    const horizontalScale = style.widthCompensation
      ? this.data.silhouette.horizontalScale(motion.renderedYaw, motion.pitch)
      : 1;
    let zoom: number;
    if (style.widthPoints > 0 && size.width > 0 && size.height > 0) {
      const aspect = size.width / size.height;
      const base = (style.widthPoints * pixelsPerPoint * 1.52 * Math.max(aspect, 1)) / size.width;
      zoom = Math.min(2.4, Math.max(0.05, motion.zoom * base * grow));
    } else if (style.dragGrow !== 1 || grow !== 1) {
      zoom = Math.min(2.4, Math.max(0.05, motion.zoom * style.zoom * grow));
    } else {
      zoom = Math.min(1.6, Math.max(0.6, motion.zoom * style.zoom));
    }
    const projection = DiamondMath.projection(size.width / Math.max(size.height, 1), zoom);
    projection[0] *= horizontalScale;
    let shift = style.growShift * (grow - 1) + style.verticalOffset;
    if (style.floatAmplitude !== 0 && style.floatPeriod > 0 && !reduceMotion) {
      shift +=
        style.floatAmplitude *
        Math.sin((2 * Math.PI * time) / style.floatPeriod) *
        (1 - p.refractionStrength);
    }
    if (shift !== 0 && size.height > 0) {
      const dy = (-2 * shift * pixelsPerPoint) / size.height;
      for (let k = 0; k < 4; k++) projection[k * 4 + 1] += dy * projection[k * 4 + 3];
    }
    const animationTime = reduceMotion
      ? 0
      : DiamondEntrance.highlightTime(time, style.animationMode === "entrance");
    let sparkle, mainSparkle;
    if (style.mainSparkleOnRotation) {
      sparkle = motion.rotationSparkle.state;
      mainSparkle = DiamondSparkleAnimation.mainPlacement(model, 0, true);
    } else {
      sparkle = DiamondSparkleAnimation.state(animationTime, style.appearance);
      const lookAhead = 1 / 120;
      const next = motion.clone();
      next.step(
        lookAhead,
        style.isRotating ? style.rotationSpeed : 0,
        reduceMotion,
        style.animationMode,
        time + lookAhead,
        style.appearance,
      );
      const dyaw = next.yaw - motion.yaw;
      const yawDelta = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const angularSpeed = Math.hypot(yawDelta, next.pitch - motion.pitch) / lookAhead;
      mainSparkle = DiamondSparkleAnimation.mainPlacement(model, angularSpeed);
    }
    const light = DiamondLightAnimation.state(animationTime);
    const flashes =
      style.appearance === Appearance.white &&
      style.animationMode === "reference" &&
      style.sparkles &&
      !reduceMotion
        ? DiamondReferenceHighlights.facetFlashes(animationTime)
        : { crown: [0, 0, 0, 0] as V4, pavilion: [0, 0, 0, 0] as V4 };
    const u = this.uniformData;
    let o = 0;
    const put = (a: ArrayLike<number>) => {
      for (let i = 0; i < a.length; i++) u[o++] = a[i];
    };
    put(model);
    put(projection);
    put(transposeRot(model));
    put([
      animationTime,
      Math.min(1, Math.max(0, style.refraction)),
      Math.max(0, style.brightness),
      style.sparkles && !reduceMotion ? 1 : 0,
    ]);
    put([size.width, size.height, this.geometry.planeCount, 0]);
    put(sparkle.shape);
    put([sparkle.haloScale, mainSparkle.faceRotation, horizontalScale, mainSparkle.visibility]);
    put(light.crown);
    put(light.pavilion);
    put(light.sweep);
    put(this.data.facetProjection);
    put(light.crownSweep);
    put(light.rightCrownSweep);
    put(light.leftCrownSweep);
    put(light.pavilionSweep);
    put(light.rightPavilionSweep);
    put(light.leftPavilionSweep);
    put([style.appearance, Math.min(1, Math.max(0, style.whiten)), Math.max(0, highlightBoost), 0]);
    put(flashes.crown);
    put(flashes.pavilion);
    return u;
  }

  encode(p: EncodeParams): void {
    const gl = this.gl;
    const { size, time, starBursts, starOffset, style, pixelsPerPoint, reduceMotion } = p;
    const u = this.buildUniforms(p);
    const lens = p.refractionSource
      ? this.lens(
          p.refractionSource,
          p.refractionStrength,
          p.motion.renderedYaw,
          u,
          pixelsPerPoint,
          p.lightBackground,
          size.width,
          size.height,
        )
      : null;
    if (p.refractionUpdated) {
      p.refractionUpdated(
        lens
          ? {
              center: { x: lens.uniforms[16], y: lens.uniforms[17] },
              hull: lens.hull.map((h) => ({ x: h[0], y: h[1] })),
              strength: p.refractionStrength,
              rotation: p.motion.renderedYaw,
            }
          : null,
      );
    }
    let stoneProgram: WebGLProgram;
    let stoneBlend = false;
    if (lens) {
      stoneProgram = this.lensProgram;
      stoneBlend = true;
    } else if (style.whiten > 0) {
      stoneProgram = this.programs.stone!;
      stoneBlend = true;
    } else {
      stoneProgram = this.programs.stone!;
    }
    if (!lens && !(style.whiten > 0)) u[48 + 4 * 14 + 1] = 0; // appearance.y

    gl.viewport(0, 0, size.width, size.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);

    const bind = (name: string, data?: Float32Array) => {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo[name]);
      if (data) gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, BINDINGS[name], this.ubo[name]);
    };
    bind("Uniforms", u);
    bind("PlaneBlock");
    bind("AnchorBlock");

    if (style.backgroundStars && style.starOpacity > 0.001 && !reduceMotion) {
      const entrance = style.animationMode === "entrance";
      const starZoomScale =
        style.starReferenceSize > 0
          ? (style.starReferenceSize * pixelsPerPoint) /
            Math.max(1, Math.min(size.width, size.height))
          : 1.0;
      const aspect = size.width / Math.max(size.height, 1);
      const sd = this.starData;
      const proj = DiamondMath.projection(
        aspect,
        Math.max(0.2, style.starZoom) * starZoomScale,
        false,
      );
      proj[12] += (2 * starOffset.x * pixelsPerPoint) / size.width;
      proj[13] -= (2 * (style.verticalOffset + starOffset.y) * pixelsPerPoint) / size.height;
      const fill = (
        projection: Float32Array,
        animation: V4,
        layout: V4,
        tint: V4,
        rightward: number,
      ) => {
        sd.set(projection, 0);
        sd.set(animation, 16);
        sd.set(layout, 20);
        sd.set(
          [style.appearance, u[48 + 4 * 14 + 1], Math.max(0, p.highlightBoost), rightward],
          24,
        );
        sd.set(tint, 28);
      };
      const baseTint: V4 = [
        1,
        Math.min(1, Math.max(0, style.starOpacity)),
        Math.max(0.05, style.starEmission),
        Math.max(0.001, style.burstFadeInDuration),
      ];
      const baseAnimation: V4 = [
        0,
        DiamondEntrance.particleTime(time, entrance),
        0,
        p.lightBackground ? 1 : 0,
      ];
      const layout: V4 = [size.width, size.height, DiamondEntrance.steadyStarCount, 0];
      const rightward = style.rightwardStars ? 1 : 0;
      gl.useProgram(this.stars);
      gl.bindVertexArray(this.vaoEmpty);
      gl.disable(gl.CULL_FACE);
      gl.depthFunc(gl.ALWAYS);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      const baseLoc = gl.getUniformLocation(this.stars, "uBaseInstance");
      if (style.steadyStars) {
        fill(proj, baseAnimation, layout, baseTint, rightward);
        bind("StarUniforms", sd);
        gl.uniform1i(baseLoc, 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, DiamondEntrance.steadyStarCount);
      }
      for (const burst of starBursts) {
        if (!(time >= burst.startTime && time - burst.startTime < DiamondStarBurst.lifetime))
          continue;
        let bp = proj,
          tint = baseTint;
        if (burst.isFromTap) {
          bp = DiamondMath.projection(aspect, starZoomScale, false);
          bp[12] = proj[12];
          bp[13] = proj[13];
          tint = [1.6, baseTint[1], 0.5, 0.03];
        }
        const anim: V4 = [time - burst.startTime, baseAnimation[1], 1, baseAnimation[3]];
        const lay: V4 = [layout[0], layout[1], layout[2], burst.seed];
        fill(bp, anim, lay, tint, rightward);
        bind("StarUniforms", sd);
        const count = Math.trunc(
          DiamondEntrance.burstStarCount *
            (burst.isFromTap ? 1 : Math.min(1, Math.max(0, style.burstSize))),
        );
        gl.uniform1i(baseLoc, DiamondEntrance.steadyStarCount);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(count, 1));
      }
    }

    gl.useProgram(stoneProgram);
    gl.bindVertexArray(this.vaoStone);
    gl.frontFace(gl.CCW);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    if (stoneBlend) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    if (lens) {
      bind("LensBlock", lens.uniforms);
      bind("EdgeBlock", lens.edges);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture(p.refractionSource!));
      gl.uniform1i(gl.getUniformLocation(stoneProgram, "uSource"), 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, this.geometry.vertexCount);

    if (style.sparkles && !reduceMotion) {
      gl.disable(gl.CULL_FACE);
      gl.depthFunc(gl.ALWAYS);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      const sp = this.programs.sparkle!;
      gl.useProgram(sp);
      gl.bindVertexArray(this.vaoMain);
      const baseLoc = gl.getUniformLocation(sp, "uBaseInstance");
      gl.uniform1i(baseLoc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.data.sparkles.mainCount);
      if (style.animationMode === "reference") {
        const hp = this.programs.highlight!;
        gl.useProgram(hp);
        const highlights =
          style.appearance === Appearance.white
            ? (this.whiteReferenceHighlights ??= new SparkleReference(
                this.geometry,
                Appearance.white,
              ))
            : (this.referenceHighlights ??= new SparkleReference(this.geometry));
        const draw = (
          instances: HighlightInstance[],
          vao: WebGLVertexArrayObject,
          count: number,
        ) => {
          if (!instances.length) return;
          const buf = new Float32Array(instances.length * 16);
          instances.forEach((h, i) => {
            buf.set(h.position, i * 16);
            buf.set(h.facing, i * 16 + 4);
            buf.set(h.axisX, i * 16 + 8);
            buf.set(h.axisY, i * 16 + 12);
          });
          gl.bindBuffer(gl.ARRAY_BUFFER, this.vbInstances);
          gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
          gl.bindVertexArray(vao);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, count, instances.length);
        };
        draw(
          highlights.smallInstances(time),
          this.vaoSmallHighlight,
          this.data.sparkles.smallCount,
        );
        draw(
          highlights.streakInstances(time),
          this.vaoStreakHighlight,
          this.data.sparkles.streakCount,
        );
      } else {
        gl.useProgram(sp);
        gl.bindVertexArray(this.vaoSmall);
        gl.uniform1i(baseLoc, 1);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this.data.sparkles.smallCount, 7);
      }
    }
    gl.bindVertexArray(null);
  }
}

function transposeRot(m: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) r[row * 4 + c] = m[c * 4 + row];
  return r;
}
