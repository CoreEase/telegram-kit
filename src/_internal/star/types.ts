export interface NodeXf {
  name: string | null;
  position: number[] | null;
  scale: number[] | null;
  orientation: number[] | null;
  hidden: boolean;
}

export interface MaterialProp {
  intensity: number | null;
  image: string | null;
}

export interface MeshManifest {
  name: string;
  path: (string | null)[];
  chain: NodeXf[];
  vertexCount: number;
  triangleCount: number;
  offsets: {
    position: number;
    normal: number;
    uv: number;
    index: number;
  };

  indexCount: number;
  indexType: "u16" | "u32" | null;
  material: {
    name: string | null;
    diffuse: MaterialProp | null;
    emission: MaterialProp | null;
    roughness: MaterialProp | null;
    metalness: MaterialProp | null;
    clearCoat: MaterialProp | null;
    selfIllumination: MaterialProp | null;
    multiply: MaterialProp | null;
  };
}

export interface EmitterManifest {
  node: string;
  position: number[];
  orientation: number[];
  birthRate: number;
  lifeSpan: number;
  lifeSpanVariation: number;
  velocity: number;
  size: number;
  sizeVariation: number;
  intensity: number;
  intensityVariation: number;
  spreadingAngle: number;
  direction: number[];
  colorVariation: number[];
  speedFactor: number;
  gravity: boolean;
  warmup: number;
  blendMode: number;
  shapeWidth?: number | null;
  shapeHeight?: number | null;
  color?: number[] | null;
  imageSequenceRowCount?: number | null;
}

export interface LightManifest {
  node: string;
  type: "ambient" | "omni" | "directional";
  intensity: number;
  position: number[];
  orientation: number[];
  attenuationEnd: number;
  temperature: number;
}

export interface SceneManifest {
  name: string;
  gravity: number[] | null;
  meshes: MeshManifest[];
  lights: LightManifest[];
  camera: {
    position: number[];
    yFov: number;
    zNear: number;
    zFar: number;
  };

  emitters: EmitterManifest[];
  byteLength: number;
}
