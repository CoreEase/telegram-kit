const HEADER = `#version 300 es
precision highp float;
precision highp int;
#define saturate(x) clamp(x, 0.0, 1.0)
`;

const UNIFORMS = `
layout(std140) uniform Uniforms {
  mat4 model;
  mat4 projection;
  mat4 inverseModel;
  vec4 parameters;       // time, refraction, brightness, sparkles
  vec4 viewport;         // width, height, optical plane count, unused
  vec4 sparkleShape;     // main layer scale, contour morph, core scale, star glow scale
  vec4 sparkleHalo;      // circular glow scale, main face rotation, horizontal correction, visibility
  vec4 crownGradient;
  vec4 pavilionGradient;
  vec4 lightSweep;       // diagonal position, environment phase, transmission, reserved
  vec4 facetProjection;  // reference pitch cosine/sine, source units, projected top
  vec4 crownSweep;
  vec4 rightCrownSweep;
  vec4 leftCrownSweep;
  vec4 pavilionSweep;
  vec4 rightPavilionSweep;
  vec4 leftPavilionSweep;
  vec4 appearance;       // palette identifier, whiten, highlight boost
  vec4 referenceCrownFlash;
  vec4 referencePavilionFlash;
} u;
`;

const PLANES = `
layout(std140) uniform PlaneBlock { vec4 planes[17]; };
`;

export const STAR_VERTEX = `${HEADER}
layout(std140) uniform StarUniforms {
  mat4 projection;
  vec4 animation;   // burst age, transport time, burst enabled, light background
  vec4 layoutInfo;  // viewport pixels, steady instance count, burst seed
  vec4 appearance;  // x: palette identifier, w: rightward fan
  vec4 tint;        // y: star opacity, z: emission radius, w: burst fade-in seconds
} su;
uniform int uBaseInstance;

out vec2 vUv;
flat out vec4 vColor;
flat out float vHaloOpacity;

float starRandom(uint seed) {
  seed ^= seed >> 16u; seed *= 0x7feb352du;
  seed ^= seed >> 15u; seed *= 0x846ca68bu;
  seed ^= seed >> 16u;
  return float(seed & 0x00ffffffu) / 16777216.0;
}

void main() {
  const vec2 corners[6] = vec2[6](vec2(-1.0,-1.0),vec2(1.0,-1.0),vec2(-1.0,1.0),
                                  vec2(-1.0,1.0),vec2(1.0,-1.0),vec2(1.0,1.0));
  uint instance = uint(gl_InstanceID + uBaseInstance);
  uint seed = instance*127u + 9137u;
  bool burst = instance >= uint(su.layoutInfo.z);
  if (burst) {
    seed += uint(su.layoutInfo.w)*104729u;
  }
  float lifetime = mix(4.5,7.5,starRandom(seed+1u));
  float clock = su.animation.y + starRandom(seed+2u)*lifetime;
  uint cycle = uint(floor(clock/lifetime));
  float age = mod(clock,lifetime);
  if (burst) {
    const float burstDurationScale = 2.0;
    lifetime = mix(1.8,3.2,starRandom(seed+1u));
    age = su.animation.x / burstDurationScale;
    cycle = 0u;
  }
  seed += cycle*7919u;
  float progress = saturate(age/lifetime);
  float alive = float(age >= 0.0 && age < lifetime) * (burst ? su.animation.z : 1.0);
  float fadeIn = burst ? smoothstep(0.0,su.tint.w,su.animation.x) : smoothstep(0.0,0.10,progress);
  float fade = fadeIn * (1.0-smoothstep(0.62,1.0,progress)) * alive * su.tint.y;
  float depth = mix(0.60,1.0,starRandom(seed+3u));
  float spread = starRandom(seed+14u);
  const float verticalSpread = 0.78;
  vec2 direction;
  if (su.appearance.w > 0.5) {
    float elevation = mix(-3.14159265/3.0,3.14159265/3.0,spread);
    direction = vec2(cos(elevation),sin(elevation));
  } else {
    float sector = starRandom(seed+4u);
    float lowerFanAngle = atan(tan(-3.14159265/6.0)/verticalSpread);
    float elevation = sector < 0.85 ? mix(lowerFanAngle,0.34,spread) : mix(0.52,1.40,spread);
    float side = starRandom(seed+15u) < 0.5 ? -1.0 : 1.0;
    direction = vec2(side*cos(elevation),sin(elevation));
  }
  float dist;
  if (burst) {
    float travelTime = max(age,0.0);
    float baseSpeed = mix(4.8,7.2,starRandom(seed+5u));
    float initialSpeed = baseSpeed * 1.40;
    float cruiseSpeed = baseSpeed * 0.30;
    const float slowdownTime = 0.40;
    dist = mix(0.10,0.32,starRandom(seed+13u)) + cruiseSpeed*travelTime
        + (initialSpeed-cruiseSpeed)*slowdownTime*(1.0-exp(-travelTime/slowdownTime));
  } else {
    dist = 0.32 + age*mix(0.38,0.63,starRandom(seed+5u));
  }
  float drift = sin(age*0.85+starRandom(seed+6u)*6.28) * (burst ? 0.06 : 0.16);
  vec2 center = direction*dist + vec2(-direction.y,direction.x)*drift;
  center *= vec2(1.0,verticalSpread)*depth;
  const float emissionHeight = -0.10;
  center.y += emissionHeight + mix(-0.26,0.24,starRandom(seed+16u))*depth;
  if (!burst) {
    float travel = length(direction*vec2(1.0,verticalSpread))*dist*depth;
    float behavior = starRandom(seed+17u);
    if (behavior < 0.34) {
      float dimStart = mix(0.76,0.90,starRandom(seed+18u));
      float dimEnd = dimStart + mix(0.16,0.22,starRandom(seed+19u));
      float returnStart = dimEnd + mix(0.04,0.09,starRandom(seed+20u));
      float returnEnd = returnStart + mix(0.14,0.22,starRandom(seed+21u));
      float endStart = returnEnd + mix(0.05,0.12,starRandom(seed+22u));
      float endV = endStart + mix(0.18,0.28,starRandom(seed+23u));
      float firstGlow = 1.0-smoothstep(dimStart,dimEnd,travel);
      float secondGlow = smoothstep(returnStart,returnEnd,travel)
          * (1.0-smoothstep(endStart,endV,travel));
      fade *= firstGlow + secondGlow;
    } else if (behavior < 0.62) {
      float revealStart = mix(0.86,1.10,starRandom(seed+18u));
      float revealEnd = revealStart + mix(0.20,0.34,starRandom(seed+19u));
      fade *= smoothstep(revealStart,revealEnd,travel);
    }
  }
  float breathPeriod = mix(2.0,3.4,starRandom(seed+24u));
  float breathPhase = age*(2.0*3.14159265/breathPeriod) + starRandom(seed+25u)*2.0*3.14159265;
  float breathWave = 0.5-0.5*cos(breathPhase);
  float shine = smoothstep(0.0,1.0,fade) * mix(0.12,1.0,breathWave);
  const float starSizeScale = 1.53;
  float radius = starSizeScale * mix(0.0228,0.084,pow(starRandom(seed+7u),1.7))*depth * mix(0.87,1.0,shine);
  fade *= smoothstep(0.72 * su.tint.z, 1.02 * su.tint.z, length(center));
  float rotation = starRandom(seed+8u)*1.57 + age*mix(-0.20,0.20,starRandom(seed+9u));
  vec2 uv = corners[gl_VertexID]*1.45;
  vec2 point = vec2(cos(rotation)*uv.x-sin(rotation)*uv.y,
                    sin(rotation)*uv.x+cos(rotation)*uv.y)*radius;
  float choice = starRandom(seed+10u);
  vec3 darkColor = choice < 0.22 ? vec3(0.045,0.36,1.0) :
                  (choice < 0.50 ? vec3(0.0,0.451,1.0) :
                  (choice < 0.82 ? vec3(0.0,0.639,1.0) : vec3(0.145,0.792,1.0)));
  float iridescence = smoothstep(0.12,1.0,shine);
  darkColor = mix(darkColor,vec3(0.247,0.894,1.0),iridescence*0.30);
  vec3 lightColor = darkColor * 0.78;
  if (int(su.appearance.x) == 1) {
    darkColor = lightColor = vec3(1.0);
  } else if (int(su.appearance.x) == 2) {
    darkColor = mix(vec3(0.52,0.84,1.0),vec3(1.0),choice*0.8+iridescence*0.2);
    lightColor = mix(vec3(0.20,0.51,0.91),vec3(0.58,0.80,1.0),choice);
  }
  vec4 pos = su.projection*vec4(center+point,-1.6-depth,1.0);
  pos.z = pos.z*2.0 - pos.w;
  gl_Position = pos;
  vUv = uv;
  vColor = vec4(mix(darkColor,lightColor,su.animation.w) * su.tint.x,
                fade*mix(0.52,0.95,starRandom(seed+11u))*mix(0.80,1.0,depth));
  vHaloOpacity = mix(0.075,0.035,su.animation.w) * su.tint.x;
}
`;

export const STAR_FRAGMENT = `${HEADER}
in vec2 vUv;
flat in vec4 vColor;
flat in float vHaloOpacity;
out vec4 fragColor;
void main() {
  vec2 p = abs(vUv);
  float distance_ = sqrt(max(p.x,0.00001))+sqrt(max(p.y,0.00001))-1.0;
  float aa = max(fwidth(distance_),0.04);
  float core = 1.0-smoothstep(-aa,aa,distance_);
  float glow = exp(-dot(vUv,vUv)*4.5)*vHaloOpacity;
  float alpha = saturate(core+glow)*vColor.a;
  fragColor = vec4(vColor.rgb*alpha,alpha);
}
`;

export const STONE_VERTEX = `${HEADER}${UNIFORMS}
layout(location=0) in vec4 aPosition;
layout(location=1) in vec4 aNormal;
layout(location=2) in vec4 aSurface;
out vec3 vLocal;
out vec3 vNormal;
out vec3 vWorld;
out vec3 vFacet;
void main() {
  vec4 world = u.model * aPosition;
  vec4 pos = u.projection * world;
  pos.z = pos.z*2.0 - pos.w;
  gl_Position = pos;
  vLocal = aPosition.xyz;
  vNormal = normalize((u.model * aNormal).xyz);
  vWorld = world.xyz;
  vFacet = aSurface.z == 3.0 ? vec3(aSurface.xy, 1.0-aSurface.x-aSurface.y)
         : vec3(float(aSurface.z == 0.0), float(aSurface.z == 1.0), float(aSurface.z == 2.0));
}
`;

const STONE_COMMON = `${HEADER}${UNIFORMS}${PLANES}
struct Raster {
  vec4 position;
  vec3 localPosition;
  vec3 normal;
  vec3 worldPosition;
  vec3 facetWeights; // table, crown, pavilion; interpolated across rounded edges
};
in vec3 vLocal;
in vec3 vNormal;
in vec3 vWorld;
in vec3 vFacet;
out vec4 fragColor;

vec3 referenceCrown(vec2 p, vec4 gradient) {
  const float stops[7] = float[7](0.0, 0.162, 0.324, 0.501, 0.667, 0.833, 1.0);
  const vec3 colors[7] = vec3[7](vec3(0.145,0.792,1.0), vec3(0.373,0.875,1.0),
      vec3(0.6,0.957,1.0), vec3(0.3,0.798,1.0), vec3(0.0,0.639,1.0),
      vec3(0.0,0.545,1.0), vec3(0.0,0.451,1.0));
  vec2 start = gradient.xy, direction = gradient.zw - start;
  float t = saturate(dot(p-start, direction) / dot(direction,direction));
  for (int i = 1; i < 7; ++i) {
    if (t <= stops[i]) { return mix(colors[i-1], colors[i], (t-stops[i-1])/(stops[i]-stops[i-1])); }
  }
  return colors[6];
}

vec3 lateralDepth(vec3 color, vec3 normal, float y, vec3 facetWeights, float opticalLuminance) {
  float horizontalNormal = length(normal.xz);
  float side = smoothstep(0.22, 0.80, abs(normal.x) / max(horizontalNormal, 0.001));
  float shoulder = smoothstep(0.06, 0.57, y);
  float lower = smoothstep(0.12, 0.90, -y);
  float reflectedLight = smoothstep(0.28, 0.78, color.g);
  vec3 deepBlue = mix(vec3(0.017, 0.035, 0.90), vec3(0.006, 0.11, 1.0), reflectedLight);
  vec3 sideColor = mix(deepBlue, vec3(0.22, 0.86, 1.0), shoulder * 0.69);
  sideColor = mix(sideColor, vec3(0.018, 0.39, 1.0), lower * 0.52);
  float reflectionDetail = 0.105 + opticalLuminance * 0.14
                         + smoothstep(0.70, 0.95, color.g) * 0.26;
  sideColor = mix(sideColor, color, reflectionDetail);
  float weight = side * 0.96 * (1.0 - facetWeights.x);
  return mix(color, sideColor, weight);
}

vec3 facetBarycentric(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 v = b-a, w = c-a, q = p-a;
  float determinant = v.x*w.y - v.y*w.x;
  float y = (q.x*w.y - q.y*w.x) / determinant;
  float z = (v.x*q.y - v.y*q.x) / determinant;
  return vec3(1.0-y-z, y, z);
}

float facetCoverage(vec3 barycentric) {
  float edge = min(barycentric.x, min(barycentric.y, barycentric.z));
  float aa = max(fwidth(edge), 0.004);
  return smoothstep(-aa, aa, edge);
}

vec2 sourceFacetPoint(vec3 localPosition, vec2 outward) {
  float across = dot(localPosition.xz, vec2(outward.y,-outward.x));
  float depth = dot(localPosition.xz,outward);
  float c = u.facetProjection.x, s = u.facetProjection.y;
  float y = c*localPosition.y-s*depth;
  float z = s*localPosition.y+c*depth;
  float w = u.projection[2].w*z+u.projection[3].w;
  return vec2(257.6+across/w*u.facetProjection.z,
              103.8+(u.facetProjection.w-y/w)*u.facetProjection.z);
}

vec3 illustratedFacets(vec3 color, Raster rs) {
  vec3 localNormal = normalize((u.inverseModel * vec4(normalize(rs.normal), 0.0)).xyz);
  vec2 outward = abs(localNormal.x) > abs(localNormal.z)
      ? vec2(sign(localNormal.x),0.0) : vec2(0.0,sign(localNormal.z));
  vec3 tangent = vec3(outward.y,0.0,-outward.x);
  vec2 p = sourceFacetPoint(rs.localPosition,outward);
  vec2 normalXZ = abs(localNormal.xz);
  float broad = 1.0-smoothstep(0.20,0.65,min(normalXZ.x,normalXZ.y)/max(max(normalXZ.x,normalXZ.y),0.0001));
  vec3 worldTangent = (u.model * vec4(tangent, 0.0)).xyz;
  vec3 n = normalize(rs.normal);
  vec3 light = normalize(vec3(0.6*sin(u.lightSweep.y), 0.5, 1.0));
  float leftLight = pow(saturate(dot(normalize(n - worldTangent*0.38), light)), 5.0);
  float rightLight = pow(saturate(dot(normalize(n + worldTangent*0.38), light)), 5.0);
  if (rs.facetWeights.y > 0.0) {
    const vec2 crownJunction = vec2(258.8,128.9);
    const vec2 crownBaseLeft = vec2(108.8,240.8);
    const vec2 crownBaseRight = vec2(406.8,240.8);
    vec3 left = facetBarycentric(p, vec2(142.1,106.3), crownJunction, crownBaseLeft);
    float leftStrength = facetCoverage(left) * (0.18 + 0.40*leftLight) * saturate(1.0-left.y);
    color = mix(color, vec3(0.79,0.988,1.0), leftStrength * rs.facetWeights.y * broad);
    vec3 right = facetBarycentric(p, crownBaseRight, crownJunction, vec2(378.5,108.2));
    float gradient = smoothstep(crownJunction.x,crownBaseRight.x,p.x);
    vec3 tint = mix(vec3(0.28,0.83,1.0),vec3(0.025,0.43,1.0),gradient);
    tint = mix(tint,vec3(0.57,0.95,1.0),rightLight*0.24);
    color = mix(color, tint, facetCoverage(right) * 0.90 * rs.facetWeights.y * broad);
  }
  if (rs.facetWeights.z > 0.0) {
    vec2 kite = vec2(dot(rs.localPosition,tangent),rs.localPosition.y);
    const float halfWidth = 0.245, top = -0.61, shoulder = -0.70, bottom = -1.075;
    const float upperHeight = top-shoulder, lowerHeight = shoulder-bottom;
    float upperEdge = ((top-kite.y)*halfWidth-abs(kite.x)*upperHeight)
        / length(vec2(halfWidth,upperHeight));
    float lowerEdge = ((kite.y-bottom)*halfWidth-abs(kite.x)*lowerHeight)
        / length(vec2(halfWidth,lowerHeight));
    float edge = min(upperEdge,lowerEdge);
    float aa = max(fwidth(edge),0.0015);
    float coverage = smoothstep(-aa,aa,edge);
    float illumination = saturate(dot(n,normalize(vec3(-0.65,0.5,1.0))));
    vec3 tint = mix(vec3(0.48,0.96,1.0),vec3(0.70,1.0,1.0),illumination);
    float across = saturate(0.5+kite.x/(2.0*halfWidth));
    tint *= mix(vec3(1.0),vec3(0.88,0.97,1.0),across);
    color = mix(color,tint,coverage*0.28*rs.facetWeights.z*broad);
  }
  return color;
}

vec3 studio(vec3 d, float phase) {
  float angle = 0.85 * sin(phase);
  d.xz = vec2(cos(angle)*d.x - sin(angle)*d.z, sin(angle)*d.x + cos(angle)*d.z);
  float up = smoothstep(-0.65, 0.85, d.y);
  vec3 c = mix(vec3(0.002, 0.075, 0.88), vec3(0.19, 0.78, 1.0), up);
  float key = pow(saturate(dot(d, normalize(vec3(-0.6, 0.8, 0.7)))), 10.0);
  float stripPosition = 0.12 + 0.48 * sin(phase);
  float strip = exp(-pow((d.x + d.y * 0.42 - stripPosition) * 9.0, 2.0));
  float side = pow(saturate(dot(d, normalize(vec3(0.8, 0.2, -0.5)))), 18.0);
  c = mix(c, vec3(0.68, 0.98, 1.0), key * 0.94);
  c = mix(c, vec3(0.80, 0.99, 1.0), strip * 0.64);
  c += side * vec3(0.1, 0.3, 0.38);
  return c;
}

vec2 facetEdgeRoll(vec2 p, vec2 a, vec2 b) {
  vec2 segment = b-a;
  float edgeLength = length(segment);
  vec2 along = segment/edgeLength;
  vec2 across = vec2(-along.y,along.x);
  float dst = dot(p-a,across);
  float progress = dot(p-a,along);
  float width = max(1.6,fwidth(dst));
  float q = dst/width;
  float ends = smoothstep(0.0,5.0,progress)*(1.0-smoothstep(edgeLength-5.0,edgeLength,progress));
  return across*(q*exp(-q*q)*0.22*ends);
}

vec3 polishedNormal(Raster rs, vec3 localNormal) {
  if (rs.facetWeights.y <= 0.0) { return normalize(rs.normal); }
  vec2 outward = abs(localNormal.x) > abs(localNormal.z)
      ? vec2(sign(localNormal.x),0.0) : vec2(0.0,sign(localNormal.z));
  vec2 normalXZ = abs(localNormal.xz);
  float broad = 1.0-smoothstep(0.20,0.65,min(normalXZ.x,normalXZ.y)/max(max(normalXZ.x,normalXZ.y),0.0001));
  vec2 p = sourceFacetPoint(rs.localPosition,outward);
  vec2 roll = facetEdgeRoll(p,vec2(258.8,128.9),vec2(108.8,240.8))
            + facetEdgeRoll(p,vec2(258.8,128.9),vec2(406.8,240.8));
  vec3 across = vec3(outward.y,0.0,-outward.x);
  vec3 up = normalize(cross(localNormal,across));
  vec3 normal = normalize(localNormal-(across*roll.x-up*roll.y)*broad*rs.facetWeights.y);
  return normalize((u.model*vec4(normal,0.0)).xyz);
}

float studioPanel(vec3 reflected, vec3 direction, vec2 size) {
  float alignment = dot(reflected,direction);
  vec3 horizontal = normalize(cross(vec3(0.0,1.0,0.0),direction));
  vec3 vertical = cross(direction,horizontal);
  vec2 point = vec2(dot(reflected,horizontal),dot(reflected,vertical))/max(alignment,0.15);
  vec2 dx = dFdx(point), dy = dFdy(point);
  vec2 variance = size*size+dx*dx+dy*dy;
  float energy = size.x*size.y/sqrt(variance.x*variance.y);
  return exp(-dot(point*point,1.0/variance))*energy*smoothstep(0.15,0.40,alignment);
}

vec3 surfaceFinish(vec3 color, vec3 normal, vec3 view) {
  vec3 reflected = reflect(-view,normal);
  float phase = u.lightSweep.y;
  float key = studioPanel(reflected,normalize(vec3(-0.36+0.14*sin(phase),0.90,0.72)),vec2(0.16,0.48));
  float rim = studioPanel(reflected,normalize(vec3(0.72,-0.52+0.10*cos(phase),0.18)),vec2(0.10,0.60));
  float fresnel = pow(1.0-saturate(dot(normal,view)),4.0);
  float strength = key*(0.35+0.35*fresnel)+rim*(0.16+0.30*fresnel);
  return mix(color,vec3(0.87,0.99,1.0),strength);
}

float nearestExit(vec3 origin, vec3 ray, inout vec3 normal) {
  float nearest = 1e5;
  float second = 1e5;
  vec3 secondNormal = normal;
  int count = int(u.viewport.z);
  for (int i = 0; i < count; ++i) {
    float denominator = dot(planes[i].xyz, ray);
    if (denominator > 0.0001) {
      float t = -(dot(planes[i].xyz, origin) + planes[i].w) / denominator;
      if (t > 0.001 && t < nearest) {
        second = nearest; secondNormal = normal;
        nearest = t; normal = planes[i].xyz;
      } else if (t > 0.001 && t < second) {
        second = t; secondNormal = planes[i].xyz;
      }
    }
  }
  if (second < 1e5) {
    float width = max(0.008,min(0.035,fwidth(second-nearest)));
    float blend = 0.5*(1.0-smoothstep(0.0,width,second-nearest));
    normal = normalize(mix(normal,secondNormal,blend));
  }
  return nearest;
}

vec4 oppositeFacets(vec3 p, vec3 ray) {
  vec3 origin = p + ray*0.004;
  vec3 normal = vec3(0.0,1.0,0.0);
  float dst = nearestExit(origin,ray,normal);
  if (dst > 100.0 || normal.y > 0.95) { return vec4(0.0); }
  vec3 hit = origin + ray*dst;
  vec3 worldNormal = (u.model*vec4(normal,0.0)).xyz;
  vec3 tangent = normalize(vec3(normal.z+0.00001,0.0,-normal.x));
  float across = dot(hit,tangent);
  vec2 authored = vec2(across*225.8, (normal.y > 0.0 ? 0.3065-hit.y : -0.54-hit.y)*239.0);
  vec3 color;
  if (normal.y > 0.0) {
    color = referenceCrown(authored,u.crownGradient);
    float response = pow(saturate(dot(worldNormal, normalize(vec3(0.7*sin(u.lightSweep.y),0.55,-1.0)))),4.0);
    color = mix(color*vec3(0.45,0.70,0.98), vec3(0.60,0.94,1.0), response*0.55);
  } else {
    vec3 reflected = normalize((u.model*vec4(reflect(ray,normal),0.0)).xyz);
    vec3 environment = studio(reflected,u.lightSweep.y);
    float response = pow(saturate(dot(worldNormal,normalize(vec3(-0.4,-0.55,-1.0)))),2.0);
    color = mix(vec3(0.012,0.38,1.0),vec3(0.27,0.94,1.0),response*0.65+environment.g*0.35);
    color = mix(color,environment,0.28);
    float panel = studioPanel(reflected,normalize(vec3(-0.36,0.90,0.72)),vec2(0.20,0.52));
    color = mix(color,vec3(0.72,0.98,1.0),panel*0.48);
  }
  float coverage = smoothstep(0.03,0.35,dst) * exp(-dst*0.16);
  return vec4(color,coverage);
}

float sourceBand(vec2 p, vec4 gradient) {
  vec2 direction = gradient.zw-gradient.xy;
  float t = dot(p-gradient.xy,direction)/dot(direction,direction);
  return saturate(1.0-abs(t-0.49)/0.49);
}

float facetSweepFn(Raster rs, vec3 localNormal) {
  vec3 tangent = normalize(vec3(localNormal.z+0.00001,0.0,-localNormal.x));
  float across = dot(rs.localPosition,tangent)*225.8;
  float side = smoothstep(0.20,0.50,abs(normalize(rs.normal).x));
  bool right = rs.normal.x > 0.0;
  vec4 crown = mix(u.crownSweep, right ? u.rightCrownSweep : u.leftCrownSweep, side);
  vec4 pavilion = mix(u.pavilionSweep, right ? u.rightPavilionSweep : u.leftPavilionSweep, side);
  return sourceBand(vec2(across,(0.3065-rs.localPosition.y)*239.0),crown)*rs.facetWeights.y
       + sourceBand(vec2(across,(-0.54-rs.localPosition.y)*235.0),pavilion)*rs.facetWeights.z;
}

float reflectionTriangle(vec3 origin, vec3 ray, vec3 a, vec3 b, vec3 c, out vec3 coordinates) {
  coordinates = vec3(0.0);
  vec3 ab = b-a, ac = c-a, crossRay = cross(ray,ac);
  float determinant = dot(ab,crossRay);
  if (abs(determinant) < 0.00001) { return 1e5; }
  vec3 offset = origin-a;
  float bu = dot(offset,crossRay)/determinant;
  vec3 q = cross(offset,ab);
  float bv = dot(ray,q)/determinant;
  float t = dot(ac,q)/determinant;
  coordinates = vec3(1.0-bu-bv,bu,bv);
  return min(min(coordinates.x,coordinates.y),coordinates.z) >= 0.0 && t > 0.001 ? t : 1e5;
}

vec3 pavilionReflections(vec3 color, vec3 origin, vec3 ray) {
  if (u.parameters.y <= 0.0) { return color; }
  const vec2 ring[8] = vec2[8](vec2(0.0,1.0),vec2(0.70710678,0.70710678),
      vec2(1.0,0.0),vec2(0.70710678,-0.70710678),vec2(0.0,-1.0),
      vec2(-0.70710678,-0.70710678),vec2(-1.0,0.0),vec2(-0.70710678,0.70710678));
  const vec3 top = vec3(0.0,-0.28,0.0), tip = vec3(0.0,-1.06,0.0);
  float entry = 0.0, exit_ = 1e5;
  vec3 entryNormal = vec3(0.0,1.0,0.0);
  vec3 worldRay = normalize((u.model*vec4(ray,0.0)).xyz);
  vec3 illumination = normalize(vec3(-0.55,0.65,1.0));
  vec3 sideColor = vec3(0.0);
  float sideWeight = 0.0;
  vec3 veilColor = vec3(0.0);
  float veilWeight = 0.0;
  for (int i = 0; i < 8; ++i) {
    vec2 current = ring[i], next = ring[(i+1)%8];
    vec3 a = vec3(current.x*0.28,-0.68,current.y*0.28);
    vec3 b = vec3(next.x*0.28,-0.68,next.y*0.28);
    for (int part = 0; part < 2; ++part) {
      vec3 peak = part == 0 ? top : tip;
      vec3 n = normalize(cross(a-peak,b-peak));
      if (dot(n,(a+b+peak)/3.0-vec3(0.0,-0.68,0.0)) < 0.0) { n = -n; }
      float denominator = dot(n,ray);
      float side = dot(n,origin-peak);
      if (abs(denominator) < 0.00001) {
        if (side > 0.0) { exit_ = -1.0; }
      } else {
        float t = -side/denominator;
        if (denominator < 0.0 && t > entry) { entry = t; entryNormal = n; }
        if (denominator > 0.0) { exit_ = min(exit_,t); }
      }
    }
    vec3 radial = vec3(current.x,0.0,current.y);
    vec3 tangent = vec3(current.y,0.0,-current.x);
    const float upperY = 0.20;
    const float extension = (upperY+0.12)/0.65;
    const float upperRadius = 0.64+(0.64-0.19)*extension;
    const float upperWidth = 0.265097+(0.265097-0.078701)*extension;
    vec3 upperLeft = radial*upperRadius - tangent*upperWidth + vec3(0.0,upperY,0.0);
    vec3 upperRight = radial*upperRadius + tangent*upperWidth + vec3(0.0,upperY,0.0);
    vec3 lowerLeft = radial*0.19 - tangent*0.078701 + vec3(0.0,-0.77,0.0);
    vec3 lowerRight = radial*0.19 + tangent*0.078701 + vec3(0.0,-0.77,0.0);
    vec3 ribbonCoordinates;
    float ribbon = reflectionTriangle(origin,ray,upperLeft,upperRight,lowerLeft,ribbonCoordinates);
    if (ribbon > 100.0) {
      ribbon = reflectionTriangle(origin,ray,upperRight,lowerRight,lowerLeft,ribbonCoordinates);
    }
    if (ribbon < 100.0) {
      vec3 hit = origin+ray*ribbon;
      float depth = (-0.12-hit.y)/0.65;
      float across = dot(hit,tangent);
      float right = mix(0.265097,0.078701,depth), left = -right;
      vec3 worldRadial = normalize((u.model*vec4(radial,0.0)).xyz);
      float facing = saturate(-dot(worldRadial,worldRay));
      float fade = smoothstep(0.0,0.065,upperY-hit.y)*(1.0-smoothstep(0.70,1.0,depth));
      float opacity = fade*(0.16+0.84*facing);
      float light = saturate(0.5+0.5*dot(worldRadial,illumination));
      float acrossPlane = saturate((across-left)/(right-left));
      float diagonal = smoothstep(-0.045,0.045,acrossPlane-0.35-depth*0.55);
      float middle = smoothstep(0.12,0.24,depth)*(1.0-smoothstep(0.50,0.64,depth));
      vec3 tint = mix(vec3(0.015,0.56,1.0),vec3(0.33,0.97,1.0),light);
      tint = mix(tint,vec3(0.42,0.97,1.0),middle*(0.32-0.20*diagonal));
      tint = mix(tint,vec3(0.015,0.46,1.0),diagonal*0.24);
      veilColor += tint*opacity;
      veilWeight += opacity;
    }
    vec3 aSide = radial*0.72 + tangent*0.055 + vec3(0.0,-0.30,0.0);
    vec3 bSide = radial*0.49 - tangent*0.105 + vec3(0.0,-0.60,0.0);
    vec3 cSide = radial*0.15 + tangent*0.020 + vec3(0.0,-0.93,0.0);
    vec3 coordinates;
    float t = reflectionTriangle(origin,ray,aSide,bSide,cSide,coordinates);
    if (t < 100.0) {
      vec3 worldRadial = normalize((u.model*vec4(radial,0.0)).xyz);
      float sideFacing = 1.0-abs(dot(worldRadial,worldRay));
      float edge = min(coordinates.y,coordinates.z);
      float opacity = smoothstep(0.20,0.75,sideFacing)
          * smoothstep(0.0,0.085,edge) * smoothstep(0.0,0.035,coordinates.x);
      float light = 0.5+0.5*dot(worldRadial,illumination);
      vec3 tint = mix(vec3(0.16,0.80,1.0),vec3(0.85,1.0,1.0),light);
      sideColor += tint*opacity;
      sideWeight += opacity;
    }
  }
  float strength = saturate(u.parameters.y/0.72);
  if (veilWeight > 0.0) {
    color = mix(color,veilColor/veilWeight,(1.0-exp(-veilWeight*0.46))*strength);
  }
  if (sideWeight > 0.0) {
    color = mix(color,sideColor/sideWeight,(1.0-exp(-sideWeight*1.4))*strength);
  }
  if (entry < exit_) {
    vec3 hit = origin+ray*entry;
    vec3 worldNormal = normalize((u.model*vec4(entryNormal,0.0)).xyz);
    float light = saturate(dot(worldNormal,normalize(vec3(-0.65,0.15,1.0))));
    float gleam = studioPanel(reflect(worldRay,worldNormal),
        normalize(vec3(-0.35+0.15*sin(u.lightSweep.y),0.60,0.75)),vec2(0.25,0.65));
    vec3 tint = mix(vec3(0.025,0.54,1.0),vec3(0.40,0.92,1.0),light);
    tint = mix(tint,vec3(0.72,0.99,1.0),gleam*0.16);
    float thickness = smoothstep(0.0,0.18,exit_-entry);
    float fade = smoothstep(-1.07,-0.93,hit.y);
    color = mix(color,tint,0.28*thickness*fade*strength);
  }
  return color;
}

// The original unrolls zero reflection bounces here; the function always returns black.
vec3 interior(vec3 p, vec3 direction, float pavilion) {
  return vec3(0.0);
}

vec3 materialPalette(vec3 color, vec3 facetWeights, int appearance) {
  switch (appearance) {
    case 1: {
      float tone = smoothstep(0.0,0.92,saturate(dot(color.rg,vec2(0.22,0.78))));
      vec3 shadow = mix(vec3(0.63,0.77,0.95),vec3(0.733,0.859,1.0),facetWeights.y*0.25);
      const vec3 ice = vec3(207.0,241.0,253.0) / 255.0;
      vec3 upper = mix(shadow,ice,smoothstep(0.0,0.62,tone));
      upper = mix(upper,vec3(1.0),smoothstep(0.58,1.0,tone)*0.92);
      vec3 lower = mix(vec3(0.59,0.71,0.865),vec3(0.96,0.985,1.0),pow(tone,1.10));
      return mix(upper,lower,facetWeights.z);
    }
    case 2: {
      float tone = smoothstep(0.035,0.90,saturate(dot(color.rg,vec2(0.20,0.80))));
      vec3 cool = mix(vec3(0.025,0.29,0.83),vec3(0.38,0.78,1.0),smoothstep(0.0,0.65,tone));
      vec3 upper = mix(cool,vec3(0.94,0.99,1.0),smoothstep(0.45,1.0,tone));
      vec3 lower = mix(vec3(0.025,0.34,0.92),vec3(0.90,0.99,1.0),pow(tone,2.35));
      return mix(upper,lower,facetWeights.z);
    }
    default: return color;
  }
}

vec3 coolInnerGlow(vec3 color, vec3 position, vec3 ray, vec3 normal, vec3 localNormal, vec3 view) {
  float thickness = 1e5;
  float planeAlignment = 0.0;
  int count = int(u.viewport.z);
  for (int i = 0; i < count; ++i) {
    planeAlignment = max(planeAlignment,dot(planes[i].xyz,localNormal));
    float denominator = dot(planes[i].xyz,ray);
    if (denominator > 0.0001) {
      float exit_ = -(dot(planes[i].xyz,position)+planes[i].w) / denominator;
      thickness = min(thickness,max(0.0,exit_));
    }
  }
  float crossSection = clamp((position.y+1.09)/0.98,0.07,1.0);
  float inner = 1.0-smoothstep(0.01,0.80*crossSection,thickness);
  float grazing = 1.0-saturate(dot(normal,view));
  float roundedEdge = smoothstep(0.0015,0.028,1.0-planeAlignment);
  float bevel = pow(grazing,3.0);
  float glow = saturate(inner*0.85 + bevel*0.85 + roundedEdge*smoothstep(0.18,0.80,grazing));
  return mix(color,vec3(0.96,1.0,1.0),glow);
}

vec4 withHighlightBoost(vec4 color, float boost) {
  if (boost <= 0.0 || color.a <= 0.0) return color;
  vec3 straight = color.rgb / color.a;
  float luminance = dot(straight, vec3(0.2126, 0.7152, 0.0722));
  return vec4(straight * (1.0 + boost * smoothstep(0.55, 1.0, luminance)) * color.a, color.a);
}

vec4 diamondSurface(Raster rs) {
  vec3 n = normalize(rs.normal);
  float cameraDistance = -u.projection[3].w / u.projection[2].w;
  vec3 view = normalize(vec3(0.0, 0.0, cameraDistance) - rs.worldPosition);
  vec3 localView = (u.inverseModel * vec4(-view, 0.0)).xyz;
  vec3 localNormal = normalize((u.inverseModel * vec4(n, 0.0)).xyz);
  vec3 transmitted = refract(localView, localNormal, 1.0 / 1.62);
  vec3 optical = interior(rs.localPosition, transmitted, rs.facetWeights.z);
  vec3 reflection = studio(reflect(-view, n), u.lightSweep.y);
  float fresnel = 0.08 + 0.46 * pow(1.0 - saturate(dot(n, view)), 4.0);

  float height = saturate((rs.localPosition.y + 1.05) / 1.65);
  float key = saturate(dot(n, normalize(vec3(-0.65, 0.85, 1.0))));
  float left = saturate(0.52 - rs.worldPosition.x * 0.43);
  vec3 blue = vec3(0.008, 0.22, 1.0);
  vec3 cyan = vec3(0.29, 0.87, 1.0);
  vec3 body = mix(blue, cyan, saturate(key * 0.60 + left * 0.38));
  float verticalBand = mix(0.5 + 0.5 * sin(height * 18.0 + n.x * 3.0),1.0,rs.facetWeights.z);
  body *= mix(vec3(0.24, 0.48, 0.96), vec3(1.0), verticalBand * 0.5 + 0.5);
  float opticalLuminance = smoothstep(0.25, 0.85, optical.g);
  vec3 opticalShadow = mix(vec3(0.005,0.13,1.0),vec3(0.015,0.36,1.0),rs.facetWeights.z);
  vec3 opticalLight = mix(vec3(0.58,0.97,1.0),vec3(0.45,0.99,1.0),rs.facetWeights.z);
  optical = mix(opticalShadow,opticalLight,opticalLuminance);
  float opticalWeight = u.parameters.y * mix(0.90, 0.08, rs.facetWeights.y);
  vec3 color = mix(body, optical, opticalWeight);
  color = mix(color, reflection, fresnel);

  float crownGlow = smoothstep(0.10, 0.60, rs.localPosition.y) * left;
  color = mix(color, vec3(0.70, 0.99, 1.0), crownGlow * 0.58);
  float crownLight = pow(saturate(dot(n, normalize(vec3(-0.38, 0.55, 1.0)))), 9.0);
  crownLight *= smoothstep(-0.03, 0.28, rs.localPosition.y);
  color = mix(color, vec3(0.65, 0.98, 1.0), crownLight * 0.35);
  vec3 facetBase = color;
  if (rs.facetWeights.y > 0.0) {
    float softbox = exp(-pow((rs.worldPosition.x + 0.42) * 1.6, 2.0)
                       -pow((rs.worldPosition.y - 0.32) * 2.2, 2.0));
    color = mix(color, vec3(0.71, 0.99, 1.0), softbox * crownLight * 0.36);
    float shadow = pow(saturate(1.0 - key), 1.4);
    color = mix(color, vec3(0.015, 0.08, 1.0), shadow * 0.7);
    vec3 tangent = normalize(vec3(localNormal.z, 0.0, -localNormal.x));
    vec2 authoredPosition = vec2(dot(rs.localPosition, tangent) * 225.8 + n.x * 65.0,
                                 (0.3065 - rs.localPosition.y) * 244.0);
    color = mix(referenceCrown(authoredPosition, u.crownGradient), color, 0.28);
    color = mix(facetBase, color, rs.facetWeights.y);
  }
  if (rs.facetWeights.z > 0.0) {
    color = mix(color,mix(vec3(0.008,0.32,1.0),optical,0.86),rs.facetWeights.z*u.parameters.y);
  }
  float facetFlash = smoothstep(0.20, 0.78, opticalLuminance);
  float flashWeight = mix(0.24,0.08,rs.facetWeights.y);
  color *= mix(vec3(1.0),mix(vec3(0.76, 0.82, 0.99), vec3(1.0), facetFlash),flashWeight);
  color = mix(color, vec3(0.66, 0.98, 1.0), pow(facetFlash, 2.0) * 0.24 * flashWeight);
  color = lateralDepth(color, n, rs.localPosition.y, rs.facetWeights, opticalLuminance);
  color = mix(color,optical,rs.facetWeights.z*u.parameters.y*0.48);
  color = mix(color,body,rs.facetWeights.z*pow(saturate(n.z),2.0)*0.32);
  vec3 rearRay = normalize(mix(localView,transmitted,mix(0.68,0.18,rs.facetWeights.y)));
  vec4 rear = oppositeFacets(rs.localPosition,rearRay);
  float transmission = mix(0.34,0.12+u.lightSweep.z*0.65,rs.facetWeights.y) * u.parameters.y;
  float facing = smoothstep(0.12,0.65,n.z);
  color = mix(color,rear.rgb,rear.a*transmission*facing*mix(1.0,0.12,rs.facetWeights.y));
  if (rs.facetWeights.z > 0.0) {
    vec3 detailRay = normalize(mix(localView,transmitted,0.16));
    color = mix(color,pavilionReflections(color,rs.localPosition,detailRay),rs.facetWeights.z);
  }
  float tipGlow = pow(saturate((-rs.localPosition.y - 0.55) / 0.50), 2.0);
  color = mix(color, vec3(0.57, 0.96, 1.0), tipGlow * 0.20);
  vec3 tableRay = localView;
  tableRay.y *= 0.72;
  if (tableRay.y > 0.001) {
    float tableHeight = -planes[0].w / planes[0].y;
    float dst = (tableHeight-rs.localPosition.y)/tableRay.y;
    vec2 hit = (rs.localPosition + tableRay*dst).xz;
    const float extent = 0.632;
    const float corner = 0.285;
    vec2 q = abs(hit);
    float edge = max(max(q.x,q.y)-extent, (q.x+q.y-extent-corner)*0.70710678);
    float aa = max(fwidth(edge),0.001);
    float coverage = 1.0-smoothstep(-aa,aa,edge);
    vec2 direction = tableRay.xz / max(length(tableRay.xz),0.0001);
    float depth = saturate(0.5+dot(hit,direction)/(2.0*extent));
    float opacity = mix(0.39,0.52,depth);
    color = mix(color,vec3(0.765,0.988,1.0),coverage*opacity
                *saturate(u.parameters.y/0.72)*rs.facetWeights.y);
  }
  color = illustratedFacets(color, rs);
  color = mix(color, vec3(0.63, 0.96, 1.0), 0.58 * rs.facetWeights.x);
  float sweep = facetSweepFn(rs,localNormal);
  float sweepCore = smoothstep(0.35,1.0,sweep);
  color = mix(color,vec3(0.592,0.953,1.0),sweep*0.20+sweepCore*sweepCore*0.62);
  color = surfaceFinish(color,polishedNormal(rs,localNormal),view);
  color = materialPalette(color,rs.facetWeights,int(u.appearance.x));
  if (int(u.appearance.x) == 2) {
    color = coolInnerGlow(color,rs.localPosition,localView,n,localNormal,view);
  }
  if (int(u.appearance.x) == 1) {
    vec2 direction = normalize(localNormal.xz + vec2(0.0,0.00001));
    float side = smoothstep(0.18,0.65,abs(direction.x));
    float front = smoothstep(0.02,0.32,direction.y);
    vec3 regions = vec3(1.0-side, side*step(0.0,direction.x), side*(1.0-step(0.0,direction.x))) * front;
    float alpha = dot(regions,u.referenceCrownFlash.xyz)*rs.facetWeights.y
                + dot(regions,u.referencePavilionFlash.xyz)*rs.facetWeights.z;
    float referenceFacing = smoothstep(0.0,0.2,(u.model * vec4(0.0,0.0,1.0,0.0)).z);
    color = mix(color,vec3(1.0),alpha*referenceFacing);
  }
  float whiten = u.appearance.y;
  if (whiten > 0.0) {
    float w = pow(whiten, 0.7);
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float lift = smoothstep(0.32, 0.62, luma);
    vec3 glass = mix(vec3(0.07, 0.33, 0.95), vec3(1.0), lift);
    float rim = pow(1.0 - saturate(abs(n.z)), 2.2);
    glass = mix(glass, vec3(1.0), rim * 0.8);
    float seam = saturate(length(fwidth(n)) * 5.5);
    glass = mix(glass, vec3(1.0), seam * 0.85);
    glass = max(glass, vec3(smoothstep(0.62, 0.95, luma)));
    color = mix(color, glass, w);
    float alpha = mix(1.0, mix(0.34, 0.94, max(lift, max(rim, seam))), w);
    return vec4(saturate(color * u.parameters.z) * alpha, alpha);
  }
  return vec4(saturate(color * u.parameters.z), 1.0);
}
`;

export const STONE_FRAGMENT = `${STONE_COMMON}
void main() {
  Raster rs = Raster(gl_FragCoord, vLocal, vNormal, vWorld, vFacet);
  fragColor = withHighlightBoost(diamondSurface(rs), u.appearance.z);
}
`;

export const LENS_FRAGMENT = `${STONE_COMMON}
layout(std140) uniform LensBlock {
  vec4 lensRect;
  vec4 lensUv;
  vec4 lensViewport;   // pixel center, pixels per point, edge count
  vec4 lensParameters; // strength, yaw, radius in points, light background
  vec4 lensCenter;     // lens center in points, preserves source colors, reserved
};
layout(std140) uniform EdgeBlock { vec4 edges[128]; };
uniform sampler2D uSource;

void main() {
  Raster rs = Raster(gl_FragCoord, vLocal, vNormal, vWorld, vFacet);
  vec4 stone = diamondSurface(rs);
  // Metal's fragment origin is top-left; WebGL's is bottom-left.
  vec2 fragPixel = vec2(gl_FragCoord.x, u.viewport.y - gl_FragCoord.y);
  vec2 position = (fragPixel - lensViewport.xy) / lensViewport.z;
  float distanceToEdge = 1e9;
  int edgeCount = int(lensViewport.w);
  for (int i = 0; i < edgeCount; ++i) {
    distanceToEdge = min(distanceToEdge, dot(edges[i].xy, position) + edges[i].z);
  }
  if (distanceToEdge <= 0.0) { fragColor = withHighlightBoost(stone, u.appearance.z); return; }

  float strength = lensParameters.x;
  float edge = smoothstep(0.0, 5.0, distanceToEdge) * strength;
  float radius = max(lensParameters.z, 1.0);
  vec2 local = position - lensCenter.xy;
  vec2 q = local / radius;
  float facet = (asin(clamp(q.x, -0.999, 0.999)) - lensParameters.y) / (3.14159265 / 4.0);
  float wave = sin(3.14159265 * facet);
  float prism = sign(wave) * pow(abs(wave), 0.6);
  float crown = 1.0 - smoothstep(-0.25, 0.05, q.y);
  vec2 bend = vec2(prism * 0.12, mix(-0.08 * q.y, 0.09, crown)) * radius;
  float zoom = mix(0.84, 0.72, crown * (1.0 - smoothstep(0.2, 0.6, abs(q.x))));
  vec2 samplePosition = lensCenter.xy + local * mix(1.0, zoom, edge) + bend * edge;
  vec2 sourcePosition = (samplePosition - lensRect.xy) / lensRect.zw;
  if (any(lessThan(sourcePosition, vec2(0.0))) || any(greaterThan(sourcePosition, vec2(1.0)))) {
    fragColor = withHighlightBoost(stone, u.appearance.z); return;
  }
  vec2 halfTexel = 0.5 / vec2(textureSize(uSource, 0));
  vec2 uv = clamp(lensUv.xy + sourcePosition * lensUv.zw,
                  lensUv.xy + halfTexel, lensUv.xy + lensUv.zw - halfTexel);
  vec4 sampledColor = texture(uSource, uv);
  float verticalTilt = asin(clamp(abs(u.model[1].z), 0.0, 1.0));
  float lensVisibility = 1.0 - smoothstep(20.0 * 3.14159265 / 180.0, 3.14159265 / 4.0, verticalTilt);
  float coverage = strength * smoothstep(0.0, 1.5, distanceToEdge) * lensVisibility;
  if (lensCenter.z > 0.5) {
    float opacity = 0.7 * coverage;
    stone.rgb = stone.rgb * (1.0 - sampledColor.a * opacity) + sampledColor.rgb * stone.a * opacity;
    fragColor = withHighlightBoost(stone, u.appearance.z); return;
  }
  float opacity = sampledColor.r * 0.55 * coverage;
  vec3 tint = lensParameters.w > 0.5 ? vec3(0.02, 0.13, 0.48) : vec3(1.0);
  stone.rgb = mix(stone.rgb, tint * stone.a, opacity);
  fragColor = withHighlightBoost(stone, u.appearance.z);
}
`;

export const SPARKLE_VERTEX = `${HEADER}${UNIFORMS}
layout(std140) uniform AnchorBlock { vec4 anchors[16]; }; // [2i] position, [2i+1] normal
layout(location=0) in vec4 aContours;
layout(location=1) in vec4 aMaterial;
uniform int uBaseInstance;
out vec2 vSourcePoint;
flat out float vStrength;
flat out int vLayer;

vec4 anchorAt(int index) {
  switch (index) {
    case 0: return anchors[0];
    case 1: return anchors[1];
    case 2: return anchors[2];
    case 3: return anchors[3];
    case 4: return anchors[4];
    case 5: return anchors[5];
    case 6: return anchors[6];
    case 7: return anchors[7];
    case 8: return anchors[8];
    case 9: return anchors[9];
    case 10: return anchors[10];
    case 11: return anchors[11];
    case 12: return anchors[12];
    case 13: return anchors[13];
    case 14: return anchors[14];
    case 15: return anchors[15];
    default: return vec4(0.0);
  }
}
void main() {
  int instance = gl_InstanceID + uBaseInstance;
  int layer = int(aMaterial.x);
  const float authoringToWorld = 2.0 / 447.9;
  vec3 local = anchorAt(instance*2).xyz;
  vec3 normal = anchorAt(instance*2+1).xyz;
  if (instance == 0) {
    float c = cos(u.sparkleHalo.y), s = sin(u.sparkleHalo.y);
    local.xz = vec2(c*local.x + s*local.z, -s*local.x + c*local.z);
    normal.xz = vec2(c*normal.x + s*normal.z, -s*normal.x + c*normal.z);
  }
  if (instance != 0) { local += normal * 0.008; }
  vec3 worldNormal = (u.model * vec4(normal, 0.0)).xyz;
  float pulse = pow(max(0.0, sin(u.parameters.x * 2.1 + float(instance) * 2.37 + 1.5)), 16.0);
  float front = instance == 0 ? u.sparkleHalo.w : smoothstep(0.15, 0.55, worldNormal.z);
  float strength = front * u.parameters.w;
  vec4 center = u.projection * u.model * vec4(local, 1.0);
  if (u.viewport.w > 0.0) {
    center = vec4(0.0, 0.0, 0.5, 1.0);
    strength = instance == 0 ? u.parameters.w : 0.0;
  }
  float morph = instance == 0 ? u.sparkleShape.y : 0.0;
  vec2 sourcePoint = mix(aContours.xy, aContours.zw, morph);
  float groupScale = 1.0;
  vec2 offset = vec2(0.0);
  if (layer == 0) { groupScale = u.sparkleHalo.x; offset.y = 5.9; }
  if (layer == 1) { groupScale = u.sparkleShape.w; offset.y = -0.8; }
  if (layer == 2) { groupScale = u.sparkleShape.z; offset.y = -0.9; }
  if (layer == 3) { groupScale = 0.309; offset = vec2(0.6, -0.4); }
  float mainEnvelope = u.viewport.w > 0.0 ? 1.0 : u.sparkleHalo.w;
  float scale = instance == 0 ? u.sparkleShape.x * mainEnvelope : (0.632 / 0.75) * pulse;
  vec2 point = (sourcePoint * groupScale + offset) * authoringToWorld * scale;
  vec4 pos = center + center.w * vec4(point.x * u.projection[0][0] / u.sparkleHalo.z,
                                      -point.y * u.projection[1][1], 0.0, 0.0);
  pos.z = pos.z*2.0 - pos.w;
  gl_Position = pos;
  vSourcePoint = sourcePoint;
  vStrength = strength;
  vLayer = layer;
}
`;

export const HIGHLIGHT_VERTEX = `${HEADER}${UNIFORMS}
layout(location=0) in vec4 aContours;
layout(location=1) in vec4 aMaterial;
layout(location=2) in vec4 aHPosition;
layout(location=3) in vec4 aHFacing;
layout(location=4) in vec4 aHAxisX;
layout(location=5) in vec4 aHAxisY;
out vec2 vSourcePoint;
flat out float vStrength;
flat out int vLayer;

void main() {
  int layer = int(aMaterial.x);
  vec3 facing = (u.model * vec4(aHFacing.xyz, 0.0)).xyz;
  vLayer = layer;
  vSourcePoint = aContours.xy;
  vStrength = aHFacing.w * u.parameters.w * smoothstep(0.05, 0.35, facing.z);
  vec4 pos;
  if (layer == 5) {
    vec4 point = aHPosition + aHAxisX * aContours.x + aHAxisY * aContours.y;
    pos = u.projection * u.model * point;
  } else {
    vec2 point = aContours.xy;
    if (layer == 3) { point = point * 0.309 + vec2(0.6, -0.4); }
    point *= (2.0 / 447.9) * aHAxisX.x;
    vec4 center = u.projection * u.model * aHPosition;
    pos = center + center.w * vec4(point.x * u.projection[0][0] / u.sparkleHalo.z,
                                   -point.y * u.projection[1][1], 0.0, 0.0);
  }
  pos.z = pos.z*2.0 - pos.w;
  gl_Position = pos;
}
`;

export const SPARKLE_FRAGMENT = `${HEADER}${UNIFORMS}
in vec2 vSourcePoint;
flat in float vStrength;
flat in int vLayer;
out vec4 fragColor;

float radialOpacity(float radius, float first, float middle) {
  if (radius <= first) { return 1.0; }
  if (radius <= middle) { return mix(1.0, 0.5, (radius-first)/(middle-first)); }
  return 0.5 * saturate((1.0-radius)/(1.0-middle));
}

vec4 withHighlightBoost(vec4 color, float boost) {
  if (boost <= 0.0 || color.a <= 0.0) return color;
  vec3 straight = color.rgb / color.a;
  float luminance = dot(straight, vec3(0.2126, 0.7152, 0.0722));
  return vec4(straight * (1.0 + boost * smoothstep(0.55, 1.0, luminance)) * color.a, color.a);
}

void main() {
  float alpha = 1.0;
  vec3 color = vec3(1.0);
  if (vLayer == 0) {
    float r = length(vSourcePoint - vec2(-0.5, 0.2)) / 108.5;
    alpha = radialOpacity(r, 0.312, 0.624) * 0.60;
  } else if (vLayer == 1) {
    float r = length(vSourcePoint - vec2(-0.5, 0.9)) / 113.1;
    alpha = radialOpacity(r, 0.297, 0.503) * 0.60;
    color = vec3(0.82, 1.0, 0.902);
  } else if (vLayer == 2) {
    alpha = 0.96;
  } else if (vLayer == 3) {
    float r = saturate(length(vSourcePoint) / length(vec2(176.0, -170.0)));
    alpha = 1.0 - r;
    color = mix(vec3(0.694, 0.969, 1.0), vec3(0.663, 0.957, 1.0), r);
  } else if (vLayer == 5) {
    alpha = radialOpacity(length(vSourcePoint) / length(vec2(228.9, 3.9)), 0.237, 0.623);
  }
  if (int(u.appearance.x) == 1) {
    color = vLayer == 0 ? vec3(0.635,0.749,1.0) : vec3(1.0);
    if (vLayer == 1) { alpha = 0.0; }
  } else if (int(u.appearance.x) == 2) {
    color = vLayer == 1 ? vec3(0.82,0.96,1.0) : vec3(1.0);
  }
  alpha = saturate(alpha * vStrength);
  fragColor = withHighlightBoost(vec4(color * alpha, alpha), u.appearance.z);
}
`;
