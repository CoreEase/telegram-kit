import { STAR_BIN, STAR_MANIFEST } from "./data/star";
import { COIN_BIN, COIN_MANIFEST } from "./data/coin";
import { TEXTURES } from "./data/textures";
import { decodeScene, type DecodedMesh } from "./mesh";
import type { SceneManifest } from "./types";
import { MESH_FS, MESH_VS, PARTICLE_FS, PARTICLE_VS } from "./shaders";
import { ParticleSystem } from "./particles";
import { generateGradientCanvas } from "./gradient";
import { Spring, easeOut, rubberBand } from "./spring";
import {
  deg2rad,
  euler,
  mul,
  normalMatrix,
  perspective,
  rgb,
  rotateByQuat,
  translation,
  type Mat4,
} from "./math";

export type StarVariant = "stars" | "premium" | "business";
export type StarHapticKind = "tap" | "impact-medium";

export const STAR_PRESETS = {
  stars: { colors: [0xe57d02, 0xf09903, 0xf9b004, 0xfdd219], particle: 0xf9b004 as number | null },
  premium: { colors: [0x6a94ff, 0x9472fd, 0xe26bd3], particle: null as number | null },
  business: { colors: [] as number[], particle: null as number | null },
};

export interface StarLook {
  exposure: number;
  ambient: number;
  top: number;
  directional: number;
  metalness: number;
}

export const defaultStarLook = (): StarLook => ({
  exposure: 1.0,
  ambient: 0.62,
  top: 0.5,
  directional: 0.4,
  metalness: 0,
});

const TEXTURE_BY_FILE: Record<string, string> = {
  "texture.jpg": TEXTURES.gradientDefault,
  "lighterTexture.jpg": TEXTURES.gradientLighter,
  "darkerTexture.jpg": TEXTURES.gradientDarker,
};

function compile(gl: WebGL2RenderingContext, type: number, src: string, label: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(`${label}: ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string, label: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, label + " vs"));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, label + " fs"));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(`${label} link: ${gl.getProgramInfoLog(p)}`);
  return p;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("texture load failed"));
    i.src = src;
  });
}

interface GpuMesh {
  mesh: DecodedMesh;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  diffuse: WebGLTexture;
  count: number;
  indexed: boolean;
  indexType: number;
}

export class StarLayer {
  readonly canvas = document.createElement("canvas");
  onReady?: () => void;
  onError?: (e: unknown) => void;
  onHaptic?: (k: StarHapticKind) => void;
  isInHierarchy = true;
  private gl!: WebGL2RenderingContext;
  private meshProg!: WebGLProgram;
  private partProg!: WebGLProgram;
  private manifest!: SceneManifest;
  private meshes: GpuMesh[] = [];
  private emission!: WebGLTexture;
  private sprite!: WebGLTexture;
  private partVao!: WebGLVertexArrayObject;
  private partBuf!: WebGLBuffer;
  private partData = new Float32Array(8 * 768);
  private particles!: ParticleSystem;
  private raf = 0;
  private lastT = 0;
  private t0 = performance.now() / 1000;
  private ready = false;
  private disposed = false;
  private reduceMotion = false;
  private idleAnimations = true;
  private look = defaultStarLook();
  private colors: number[] = [];
  private particleColor: number | null = null;
  private gradientTex: WebGLTexture | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private pitch = 0;
  private yaw = 0;

  private anim: null | {
    kind: "spin" | "out" | "back";
    t0: number;
    fromP: number;
    fromY: number;
    toP: number;
    toY: number;
    spring?: Spring;
    dur: number;
  } = null;
  private dragging = false;
  private lastInteraction = 0;
  private delayTapsTill = 0;
  private idleTimer = 0;
  private boostUntil = 0;

  constructor(private variant: StarVariant) {
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;";
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.init().catch((e) => this.onError?.(e));
  }

  private async init() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: true,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.meshProg = program(gl, MESH_VS, MESH_FS, "star mesh");
    this.partProg = program(gl, PARTICLE_VS, PARTICLE_FS, "star particles");
    const business = this.variant === "business";
    this.manifest = business ? COIN_MANIFEST : STAR_MANIFEST;
    const decoded = decodeScene(this.manifest, business ? COIN_BIN : STAR_BIN);
    const [emImg, spImg] = await Promise.all([
      loadImage(TEXTURES.diagonalShine),
      loadImage(TEXTURES.particle),
    ]);
    const files = [
      ...new Set(
        decoded
          .map((m) => m.manifest.material.diffuse?.image)
          .filter((x): x is string => !!x && !!TEXTURE_BY_FILE[x]),
      ),
    ];
    const imgs = new Map<string, HTMLImageElement>();
    await Promise.all(files.map(async (f) => imgs.set(f, await loadImage(TEXTURE_BY_FILE[f]))));
    if (this.disposed) return;
    this.emission = this.makeTexture(emImg, gl.CLAMP_TO_EDGE);
    this.sprite = this.makeTexture(spImg, gl.CLAMP_TO_EDGE);
    this.meshes = decoded
      .filter((m) => !(business && m.name === "Affiliate"))
      .map((m) =>
        this.upload(
          m,
          business
            ? this.makeTexture(
                imgs.get(m.manifest.material.diffuse?.image ?? "texture.jpg")!,
                gl.MIRRORED_REPEAT,
              )
            : this.ensureGradient(),
        ),
      );
    const preset = STAR_PRESETS[this.variant];
    if (!this.colors.length) this.colors = preset.colors;
    if (this.particleColor === null && this.variant !== "premium")
      this.particleColor = preset.particle;
    if (!business) this.applyGradient();
    this.particles = new ParticleSystem(
      this.manifest.emitters,
      this.manifest.gravity,
      rgb(0xaa69ea),
    );
    this.applyParticleColor();
    this.particles.warmup(6);
    this.partVao = gl.createVertexArray()!;
    this.partBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    this.ready = true;
    this.lastInteraction = this.now();
    this.idleTimer = window.setInterval(() => {
      if (
        this.idleAnimations &&
        !this.reduceMotion &&
        this.isInHierarchy &&
        this.now() > this.lastInteraction + 5
      )
        this.spin({ mirror: Math.random() < 0.5 });
    }, 1000);
    this.onReady?.();
    this.loop();
  }

  private makeTexture(src: TexImageSource, wrap: number) {
    const gl = this.gl,
      t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  private ensureGradient() {
    if (!this.gradientTex)
      this.gradientTex = this.makeTexture(
        generateGradientCanvas(
          this.colors.length ? this.colors : STAR_PRESETS[this.variant].colors,
        ),
        this.gl.MIRRORED_REPEAT,
      );
    return this.gradientTex;
  }

  private applyGradient() {
    if (this.variant === "business" || !this.gl || !this.gradientTex) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.gradientTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      generateGradientCanvas(this.colors),
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  private upload(m: DecodedMesh, diffuse: WebGLTexture): GpuMesh {
    const gl = this.gl,
      vao = gl.createVertexArray()!,
      buffers: WebGLBuffer[] = [];
    gl.bindVertexArray(vao);
    const attr = (loc: number, data: Float32Array, size: number) => {
      const b = gl.createBuffer()!;
      buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    attr(0, m.position, 3);
    attr(1, m.normal, 3);
    attr(2, m.uv, 2);
    let indexType: number = gl.UNSIGNED_SHORT;
    if (m.index) {
      const b = gl.createBuffer()!;
      buffers.push(b);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.index, gl.STATIC_DRAW);
      indexType = m.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    }

    gl.bindVertexArray(null);
    return {
      mesh: m,
      vao,
      buffers,
      diffuse,
      count: m.index ? m.index.length : m.vertexCount,
      indexed: !!m.index,
      indexType,
    };
  }

  private applyParticleColor() {
    if (!this.particles) return;
    const c = this.particleColor;
    for (const e of this.particles.emitters) {
      if (c !== null) {
        e.color = rgb(c);
        e.intensity = Math.min(1, e.intensity * 2);
        e.intensityVariation = 0.05;
        e.colorVariation = [0.1, 0, 0.12, 0];
        e.enabled = true;
      } else {
        e.color = rgb(0xaa69ea);
        e.colorVariation = [0.12, 0.03, 0.035, 0];
        e.enabled = !e.node.startsWith("coins_");
      }
    }
  }

  setColors(colors: number[], particleColor: number | null | undefined) {
    this.colors = colors;
    if (particleColor !== undefined) this.particleColor = particleColor;
    if (!this.ready) return;
    this.applyGradient();
    this.applyParticleColor();
    this.spin({ mirror: colors.includes(0xe57d02), explode: true, force: true });
  }

  setLook(look: Partial<StarLook>) {
    this.look = { ...this.look, ...look };
  }
  setReduceMotion(v: boolean) {
    this.reduceMotion = v;
  }
  setIdleAnimations(v: boolean) {
    this.idleAnimations = v;
  }
  resize(cssW: number, cssH: number, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    this.w = Math.max(1, cssW);
    this.h = Math.max(1, cssH);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
  }

  dragBegan() {
    this.cancelAnim();
    this.dragging = true;
    this.touch();
  }

  dragChanged(dx: number, dy: number) {
    if (!this.dragging) return;
    this.touch();
    const py = Math.abs(dy),
      banded = rubberBand(py) * (dy < 0 ? -1 : 1);
    this.yaw = deg2rad(dx);
    this.pitch = deg2rad(banded);
  }

  dragEnded(vx: number) {
    if (!this.dragging) return;
    this.dragging = false;
    const small = this.yaw < Math.PI / 2 && this.yaw > -Math.PI / 2 && Math.abs(vx) < 200;
    this.spin({ velocity: vx, smallAngle: small, explode: !small && Math.abs(vx) > 600 });
  }

  tap(dx: number, dy: number) {
    const t = this.now();
    this.touch();
    if (t < this.delayTapsTill || Math.abs(dx) > 60) return;
    const left = Math.abs(dx) > 20 ? dx < 0 : undefined;
    const top = Math.abs(dy) > 20 ? dy < 0 : undefined;
    if (this.anim && this.anim.kind !== "spin" && left !== undefined) {
      this.spin({ mirror: left, explode: true });
      this.onHaptic?.("impact-medium");
      return;
    }

    const toY = left === undefined ? 0 : left ? -0.6 : 0.6;
    const toP = top === undefined ? 0 : top ? -0.3 : 0.3;
    this.anim = { kind: "out", t0: t, fromP: this.pitch, fromY: this.yaw, toP, toY, dur: 0.25 };
    this.onHaptic?.("tap");
  }

  spin(
    o: {
      velocity?: number;
      smallAngle?: boolean;
      mirror?: boolean;
      explode?: boolean;
      force?: boolean;
    } = {},
  ) {
    const t = this.now();
    this.touch();
    this.delayTapsTill = t + 0.85;
    if (o.explode) this.explode();
    let fromY = this.yaw;
    if (Math.abs(fromY) - Math.PI * 2 < 0.05 && Math.abs(fromY) < 0.05) fromY = 0;
    let toY = o.smallAngle ? 0 : Math.PI * 2;
    if (o.velocity !== undefined && !o.smallAngle && Math.abs(o.velocity) > 200 && o.velocity < 0)
      toY *= -1;
    if (o.mirror) toY *= -1;
    const dist = ((toY - fromY) * 180) / Math.PI;
    if (!dist) return;
    const v0 = o.velocity !== undefined ? Math.abs(o.velocity / dist) : 1.7;
    const spring = new Spring(1, 21, 5.8, v0);
    this.anim = {
      kind: "spin",
      t0: t,
      fromP: this.pitch,
      fromY,
      toP: 0,
      toY,
      spring,
      dur: spring.settling * 0.75,
    };
  }

  explode() {
    if (!this.ready) return;
    const t = this.now();
    this.boostUntil = t + 1;
    const set = (
      n: string,
      v: Partial<{
        speedFactor: number;
        velocity: number;
        birthRate: number;
        lifeSpan: number;
      }>,
    ) => {
      const e = this.particles.get(n);
      if (e) Object.assign(e, v);
    };

    for (const n of ["particles_left", "particles_right"])
      set(n, { speedFactor: 2, velocity: 1.6, birthRate: 60, lifeSpan: 4 });
    for (const n of ["particles_left_bottom", "particles_right_bottom"])
      set(n, { velocity: 1.6, birthRate: 24, lifeSpan: 7 });
    this.particles.explode();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.idleTimer);
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }

  private now() {
    return performance.now() / 1000 - this.t0;
  }
  private touch() {
    this.lastInteraction = this.now();
  }
  private cancelAnim() {
    this.anim = null;
  }
  private onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.ready = false;
  };
  private onRestored = () => {
    clearInterval(this.idleTimer);
    this.meshes = [];
    this.gradientTex = null;
    this.init().catch((e) => this.onError?.(e));
  };

  private loop = () => {
    if (this.disposed || !this.ready) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.isInHierarchy) {
      this.lastT = 0;
      return;
    }

    const t = this.now();
    const dt = this.lastT ? Math.min(0.05, t - this.lastT) : 1 / 60;
    this.lastT = t;
    this.update(t, dt);
    this.draw(t);
  };

  private update(t: number, dt: number) {
    const a = this.anim;
    if (a) {
      const el = t - a.t0;
      if (a.kind === "out") {
        const k = easeOut(el / a.dur);
        this.pitch = a.fromP + (a.toP - a.fromP) * k;
        this.yaw = a.fromY + (a.toY - a.fromY) * k;
        if (el >= a.dur) {
          const sp = new Spring(1, 21, 5.8, 0);
          this.anim = {
            kind: "back",
            t0: t,
            fromP: a.toP,
            fromY: a.toY,
            toP: 0,
            toY: 0,
            spring: sp,
            dur: sp.settling * 0.8,
          };
        }
      } else {
        const k = a.spring!.at(el);
        this.pitch = a.fromP + (a.toP - a.fromP) * k;
        this.yaw = a.fromY + (a.toY - a.fromY) * k;
        if (el >= a.dur) {
          this.pitch = 0;
          this.yaw = 0;
          this.anim = null;
        }
      }
    }

    if (this.boostUntil && t >= this.boostUntil) {
      this.boostUntil = 0;
      const set = (n: string, v: object) => {
        const e = this.particles.get(n);
        if (e) Object.assign(e, v);
      };

      for (const n of ["particles_left", "particles_right"])
        set(n, { birthRate: 15, velocity: 1, lifeSpan: 3, speedFactor: 1.2 });
      for (const n of ["particles_left_bottom", "particles_right_bottom"])
        set(n, { birthRate: 10, velocity: 1, lifeSpan: 5 });
    }

    for (const n of ["particles_left", "particles_right"]) {
      const e = this.particles.get(n);
      if (e && !this.boostUntil && e.speedFactor > 0.85)
        e.speedFactor = Math.max(0.85, e.speedFactor - (0.35 / 0.5) * dt);
    }

    if (!this.reduceMotion) this.particles.step(dt);
  }

  private draw(t: number) {
    const gl = this.gl;
    const W = this.canvas.width,
      H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    const cam = this.manifest.camera;
    const proj = perspective(deg2rad(cam.yFov), W / H, cam.zNear, cam.zFar);
    const view = translation(-cam.position[0], -cam.position[1], -cam.position[2]);
    const viewProj = mul(proj, view);
    const rot = euler(this.pitch, this.yaw, 0);
    gl.useProgram(this.meshProg);
    const U = (n: string) => gl.getUniformLocation(this.meshProg, n);
    const lights = Object.fromEntries(this.manifest.lights.map((l) => [l.node, l]));
    const top = lights["top"],
      front = lights["frontal"],
      dir = lights["rightside"];
    const L = this.look;
    gl.uniformMatrix4fv(U("uViewProj"), false, viewProj);
    gl.uniform3f(U("uCamPos"), cam.position[0], cam.position[1], cam.position[2]);
    gl.uniform3f(U("uAmbient"), L.ambient, L.ambient, L.ambient);
    gl.uniform3fv(U("uTopPos"), top.position);
    gl.uniform3f(U("uTopCol"), L.top, L.top, L.top);
    gl.uniform3fv(U("uFrontPos"), front.position);
    gl.uniform3f(U("uFrontCol"), 0.01, 0.01, 0.01);
    const toLight = rotateByQuat([0, 0, 1], dir.orientation);
    gl.uniform3f(U("uDirToLight"), toLight[0], toLight[1], toLight[2]);
    gl.uniform3f(U("uDirCol"), L.directional, L.directional, L.directional);
    gl.uniform1f(U("uExposure"), L.exposure);
    gl.uniform1f(U("uAlpha"), 1);
    gl.uniform3f(U("uTint"), 1, 1, 1);
    gl.uniform1i(U("uDiffuse"), 0);
    gl.uniform1i(U("uEmission"), 1);
    const ph = this.reduceMotion ? 0 : (t % 9) / 4.5,
      tri = ph <= 1 ? ph : 2 - ph;
    gl.uniform3f(U("uDiffuseXf"), 0.24 - 0.35 * tri, -0.24 + 0.35 * tri, 1);
    let ex = 1.0;
    if (!this.reduceMotion && t >= 1) {
      const c = (t - 1) % 4;
      ex = c < 1.1 ? 1.0 : c < 2.0 ? 1.0 - 0.8 * easeOut((c - 1.1) / 0.9) : 0.2;
    }

    gl.uniform3f(U("uEmissionXf"), ex, 0.15, 0.5);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.emission);
    for (const g of this.meshes) {
      const m = g.mesh,
        mat = m.manifest.material;
      const model = mul(m.pre, mul(rot, m.post));
      gl.uniformMatrix4fv(U("uModel"), false, model);
      gl.uniformMatrix3fv(U("uNormalMat"), false, normalMatrix(model));
      gl.uniform1f(U("uRoughness"), mat.roughness?.intensity ?? 0.45);
      gl.uniform1f(U("uMetalness"), L.metalness);
      gl.uniform1f(U("uClearCoat"), mat.clearCoat?.intensity ?? 0.7);
      gl.uniform1f(U("uSelfIllum"), mat.selfIllumination?.intensity ?? 0.75);
      gl.uniform1f(U("uEmissionIntensity"), mat.emission?.intensity ?? 0.15);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.diffuse);
      gl.bindVertexArray(g.vao);
      if (g.indexed) gl.drawElements(gl.TRIANGLES, g.count, g.indexType, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, g.count);
    }

    const n = this.particles.pack(this.partData);
    if (n > 0) {
      gl.useProgram(this.partProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.partProg, "uViewProj"), false, viewProj);
      gl.uniform1f(
        gl.getUniformLocation(this.partProg, "uPixelScale"),
        H / (2 * Math.tan(deg2rad(cam.yFov) / 2)),
      );
      gl.uniform1i(gl.getUniformLocation(this.partProg, "uSprite"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sprite);
      gl.bindVertexArray(this.partVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData, 0, n * 8);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.depthMask(true);
    }

    gl.bindVertexArray(null);
  }
}
