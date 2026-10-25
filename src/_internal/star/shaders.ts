const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

export const MESH_VS =
  HEADER +
  `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMat;

out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;

void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(uNormalMat * aNormal);
  vUv = aUv;
  gl_Position = uViewProj * w;
}
`;

export const MESH_FS =
  HEADER +
  `
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;

uniform sampler2D uDiffuse;
uniform sampler2D uEmission;
uniform vec3 uDiffuseXf;
uniform vec3 uEmissionXf;
uniform float uEmissionIntensity;

uniform vec3 uCamPos;
uniform vec3 uAmbient;
uniform vec3 uTopPos;
uniform vec3 uTopCol;
uniform vec3 uFrontPos;
uniform vec3 uFrontCol;
uniform vec3 uDirToLight;
uniform vec3 uDirCol;

uniform float uRoughness;
uniform float uMetalness;
uniform float uClearCoat;
uniform float uSelfIllum;
uniform float uExposure;
uniform float uAlpha;
uniform vec3 uTint;

out vec4 outColor;

const float PI = 3.14159265;

float D_GGX(float NH, float a) {
  float a2 = a * a;
  float d = NH * NH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-5);
}
float V_Smith(float NL, float NV, float a) {
  float k = a * 0.5;
  float gl = NL / (NL * (1.0 - k) + k);
  float gv = NV / (NV * (1.0 - k) + k);
  return gl * gv;
}
vec3 F_Schlick(vec3 f0, float VH) {
  return f0 + (1.0 - f0) * pow(1.0 - VH, 5.0);
}

vec3 lobe(vec3 N, vec3 V, vec3 L, vec3 radiance, vec3 base, vec3 f0, float rough) {
  float NL = max(dot(N, L), 0.0);
  if (NL <= 0.0) return vec3(0.0);
  vec3 H = normalize(V + L);
  float NV = max(dot(N, V), 1e-3);
  float NH = max(dot(N, H), 0.0);
  float VH = max(dot(V, H), 0.0);
  float a = max(rough * rough, 0.02);
  vec3 F = F_Schlick(f0, VH);
  vec3 spec = D_GGX(NH, a) * V_Smith(NL, NV, a) * F / max(4.0 * NL * NV, 1e-3);
  vec3 diff = (1.0 - F) * (1.0 - uMetalness) * base / PI;
  return (diff + spec) * radiance * NL * PI;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);

  vec2 duv = vUv * uDiffuseXf.z + uDiffuseXf.xy;
  vec3 base = pow(texture(uDiffuse, duv).rgb, vec3(2.2)) * pow(uTint, vec3(2.2));
  vec3 f0 = mix(vec3(0.04), base, uMetalness);

  vec3 col = base * (1.0 - uMetalness) * uAmbient;

  vec3 Lt = normalize(uTopPos - vWorld);
  col += lobe(N, V, Lt, uTopCol, base, f0, uRoughness);
  vec3 Lf = normalize(uFrontPos - vWorld);
  col += lobe(N, V, Lf, uFrontCol, base, f0, uRoughness);
  col += lobe(N, V, uDirToLight, uDirCol, base, f0, uRoughness);

  if (uClearCoat > 0.0) {
    vec3 cc = vec3(0.04);
    float a = 0.08;
    float NV = max(dot(N, V), 1e-3);
    vec3 sum = vec3(0.0);
    vec3 Ls[3] = vec3[3](Lt, Lf, uDirToLight);
    vec3 Cs[3] = vec3[3](uTopCol, uFrontCol, uDirCol);
    for (int i = 0; i < 3; i++) {
      vec3 L = Ls[i];
      float NL = max(dot(N, L), 0.0);
      vec3 H = normalize(V + L);
      float NH = max(dot(N, H), 0.0);
      float VH = max(dot(V, H), 0.0);
      sum += D_GGX(NH, a) * V_Smith(NL, NV, a) * F_Schlick(cc, VH) / max(4.0 * NL * NV, 1e-3) * Cs[i] * NL * PI;
    }
    float fr = pow(1.0 - NV, 5.0);
    col += uClearCoat * (sum + vec3(0.04 + 0.96 * fr) * 0.06);
  }

  col += base * uSelfIllum * 0.18;

  vec2 euv = vUv * uEmissionXf.z + uEmissionXf.xy;
  vec4 em = texture(uEmission, euv);
  col += em.rgb * em.a * uEmissionIntensity;

  col = aces(col * uExposure);
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col * uAlpha, uAlpha);
}
`;

export const PARTICLE_VS =
  HEADER +
  `
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aSize;
layout(location = 2) in vec4 aColor;
uniform mat4 uViewProj;
uniform float uPixelScale;
out vec4 vColor;
void main() {
  vec4 p = uViewProj * vec4(aPos, 1.0);
  gl_Position = p;
  gl_PointSize = max(1.0, aSize * uPixelScale / max(p.w, 0.001));
  vColor = aColor;
}
`;

export const PARTICLE_FS =
  HEADER +
  `
in vec4 vColor;
uniform sampler2D uSprite;
out vec4 outColor;
void main() {
  vec4 t = texture(uSprite, gl_PointCoord);
  float a = t.a * vColor.a;
  outColor = vec4(vColor.rgb * t.rgb * a, a);
}
`;
