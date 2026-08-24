import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThemeSceneProps } from "../themeTypes";
import {
  mapSignalRunnerChromaHue,
  SIGNAL_RUNNER_CHROMA_HUE_RESPONSE,
} from "../../app/sharedChroma";
import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";
import {
  SIGNAL_NEXUS_REACTIVITY,
  createNeutralSignalNexusReactiveState,
  resolveSignalNexusReactiveTarget,
  stepSignalNexusReactiveState,
} from "./signalNexusReactivity";
import "./cosmicNexus.css";

type NexusShell = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  spin: THREE.Vector3;
  wobble: number;
  baseRotation: THREE.Euler;
  baseColor: THREE.Color;
};

type NexusRing = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  spin: number;
  pulsePhase: number;
  baseRotation: THREE.Euler;
  baseColor: THREE.Color;
};

type Satellite = {
  group: THREE.Group;
  shell: THREE.Mesh;
  shellMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  yDrift: number;
  basePosition: THREE.Vector3;
  baseShellRotation: THREE.Euler;
  baseShellColor: THREE.Color;
  baseGlowColor: THREE.Color;
};

type InboundLane = {
  curve: THREE.Curve<THREE.Vector3>;
  innerMaterial: THREE.MeshBasicMaterial;
  outerMaterial: THREE.MeshBasicMaterial;
  baseInnerOpacity: number;
  baseOuterOpacity: number;
  travelRate: number;
  pulseBoost: number;
  baseInnerColor: THREE.Color;
  baseOuterColor: THREE.Color;
};

type TravelingPulse = {
  core: THREE.Mesh;
  glow: THREE.Mesh;
  coreMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  lane: InboundLane;
  offset: number;
  baseProgress: number;
  baseCoreColor: THREE.Color;
  baseGlowColor: THREE.Color;
};

type RailShot = {
  group: THREE.Group;
  coreMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  helixMaterial: THREE.MeshBasicMaterial;
  cycleRate: number;
  cycleOffset: number;
  duty: number;
  readyEnabled: boolean;
  baseCoreColor: THREE.Color;
  baseGlowColor: THREE.Color;
  baseHelixColor: THREE.Color;
};

type LightningArc = {
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
  points: THREE.Vector3[];
  jitter: number;
  phase: number;
  baseColor: THREE.Color;
};

type ActivationWave = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  delay: number;
};

type SupernovaWave = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  delay: number;
};

type StarLayer = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
};

type SweepBeam = {
  group: THREE.Group;
  coreMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  baseY: number;
  phase: number;
  speed: number;
  baseRotationZ: number;
  baseCoreColor: THREE.Color;
  baseGlowColor: THREE.Color;
};

type FloatingGlyph = {
  mesh: THREE.LineLoop;
  material: THREE.LineBasicMaterial;
  basePosition: THREE.Vector3;
  phase: number;
  baseRotationZ: number;
  baseColor: THREE.Color;
};

const COSMIC_NEXUS_NEUTRAL_HUE_OFFSET_DEGREES = 0;
const COSMIC_NEXUS_NEUTRAL_SATURATION_MULTIPLIER = 1;
const COSMIC_NEXUS_NEUTRAL_EMISSIVE_MULTIPLIER = 1;

const COLORS = {
  cyan: 0x79fff2,
  green: 0x39ff14,
  pink: 0xff4d7a,
  orange: 0xff7a00,
  violet: 0x9b4dff,
  white: 0xe9fffb,
};

const COSMIC_NEXUS_CHROMA_TUNING = {
  palette: {
    neonGreen: COLORS.green,
    cyan: COLORS.cyan,
    salmon: COLORS.pink,
    violet: COLORS.violet,
    amber: COLORS.orange,
    authoredWhite: COLORS.white,
    deepTeal: 0x2dded4,
  },
  globalFilter: {
    hueScale: 0.14,
    saturationMin: 1,
    saturationMax: 1.04,
    brightnessMin: 0.995,
    brightnessMax: 1.055,
  },
  timingPerSecond: {
    kickAccent: { attack: 16, release: 3.1 },
    auraBass: { attack: 4.2, release: 1.6 },
    starHigh: { attack: 10.5, release: 4.2 },
    ringDriftBaseRate: 0.24,
    ringDriftMidsRate: 0.45,
  },
  familyMix: {
    shell: { min: 0.3, max: 0.66 },
    ring: { min: 0.42, max: 0.78 },
    lane: { min: 0.34, max: 0.76 },
    pulseKick: { min: 0.45, max: 0.86 },
    aura: { min: 0.3, max: 0.72 },
    stars: { min: 0.12, max: 0.38 },
  },
} as const;

function inQuietZone(x: number, y: number) {
  const upperLeftConsoleZone = x < -2.2 && y > 1.4;
  const lowerRightFeedZone = x > 3.6 && y < -1.1;
  return upperLeftConsoleZone || lowerRightFeedZone;
}

function CosmicNexusTheme(props: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visualStateRef = useRef(props);

  useEffect(() => {
    visualStateRef.current = props;
  }, [props]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010104);
    scene.fog = new THREE.FogExp2(0x010104, 0.024);

    const camera = new THREE.PerspectiveCamera(
      58,
      mount.clientWidth / mount.clientHeight,
      0.1,
      140,
    );
    camera.position.set(0, 0, 11);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.willChange = "filter";
    mount.appendChild(renderer.domElement);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.add(geometry);
      return geometry;
    };

    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.add(material);
      return material;
    };

    const world = new THREE.Group();
    scene.add(world);

    const createStarLayer = (
      count: number,
      spreadX: number,
      spreadY: number,
      size: number,
      color: number,
      opacity: number,
      minZ: number,
      maxZ: number,
      respectQuietZones: boolean,
    ): StarLayer => {
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const phases = new Float32Array(count);
      const brightness = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      const baseColor = new THREE.Color(color);

      for (let i = 0; i < count; i += 1) {
        let x: number;
        let y: number;
        let attempts = 0;

        do {
          x = (Math.random() - 0.5) * spreadX;
          y = (Math.random() - 0.5) * spreadY;
          attempts += 1;
        } while (respectQuietZones && attempts < 8 && inQuietZone(x, y));

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ);
        sizes[i] = size * (0.62 + Math.random() * 0.38);
        phases[i] = Math.random() * Math.PI * 2;
        brightness[i] = 0.55 + Math.random() * 0.45;
        const starColor = baseColor
          .clone()
          .offsetHSL(
            (Math.random() - 0.5) * 0.035,
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
          );
        colors[i * 3] = starColor.r;
        colors[i * 3 + 1] = starColor.g;
        colors[i * 3 + 2] = starColor.b;
      }

      const geometry = trackGeometry(new THREE.BufferGeometry());
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "aSize",
        new THREE.Float32BufferAttribute(sizes, 1),
      );
      geometry.setAttribute(
        "aPhase",
        new THREE.Float32BufferAttribute(phases, 1),
      );
      geometry.setAttribute(
        "aBrightness",
        new THREE.Float32BufferAttribute(brightness, 1),
      );
      geometry.setAttribute(
        "aColor",
        new THREE.Float32BufferAttribute(colors, 3),
      );

      const material = trackMaterial(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uHueShift: { value: 0 },
            uTwinkle: { value: 1 },
            uSurge: { value: 0 },
            uSizeScale: { value: 1 },
            uLayerTint: { value: baseColor.clone() },
          },
          vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            attribute float aBrightness;
            attribute vec3 aColor;
            uniform float uTime;
            uniform float uSurge;
            uniform float uSizeScale;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              float pulse = 0.84 + 0.16 * sin(uTime * (0.7 + aBrightness) + aPhase);
              vec3 adjusted = position + normalize(position + vec3(0.01)) * uSurge * 0.7;
              mvPosition = modelViewMatrix * vec4(adjusted, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = max(1.0, aSize * uSizeScale * pulse * (180.0 / max(1.0, -mvPosition.z)));
              vColor = aColor;
              vAlpha = aBrightness * pulse;
            }
          `,
          fragmentShader: `
            uniform float uOpacity;
            uniform float uHueShift;
            uniform float uTwinkle;
            uniform vec3 uLayerTint;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              vec2 point = gl_PointCoord - 0.5;
              float distanceToCenter = length(point);
              float alpha = 1.0 - smoothstep(0.22, 0.5, distanceToCenter);
              if (alpha <= 0.0) discard;
              vec3 hueTint = vec3(
                0.5 + 0.5 * sin(uHueShift * 6.283 + 0.0),
                0.5 + 0.5 * sin(uHueShift * 6.283 + 2.094),
                0.5 + 0.5 * sin(uHueShift * 6.283 + 4.188)
              );
              vec3 color = mix(vColor, hueTint, min(0.28, abs(uHueShift) * 0.18));
              color = mix(color, uLayerTint, 0.16);
              gl_FragColor = vec4(color, alpha * uOpacity * vAlpha * uTwinkle);
            }
          `,
        }),
      );

      const points = new THREE.Points(geometry, material);
      world.add(points);
      return { points, material };
    };

    const distantStars = createStarLayer(
      3800,
      74,
      42,
      0.62,
      0xffffff,
      0.56,
      -42,
      -9,
      false,
    );
    const accentStars = createStarLayer(
      1200,
      66,
      32,
      0.82,
      0xffffff,
      0.28,
      -28,
      -2,
      true,
    );
    const brightStars = createStarLayer(
      260,
      60,
      28,
      1.25,
      0xd9fffb,
      0.42,
      -18,
      0,
      true,
    );
    const distantStarsMaterial = distantStars.material;
    const accentStarsMaterial = accentStars.material;
    const brightStarsMaterial = brightStars.material;
    const starBaseOpacity = {
      distant: distantStarsMaterial.uniforms.uOpacity.value as number,
      accent: accentStarsMaterial.uniforms.uOpacity.value as number,
      bright: brightStarsMaterial.uniforms.uOpacity.value as number,
    };
    const starBaseColors = {
      distant: (
        distantStarsMaterial.uniforms.uLayerTint.value as THREE.Color
      ).clone(),
      accent: (
        accentStarsMaterial.uniforms.uLayerTint.value as THREE.Color
      ).clone(),
      bright: (
        brightStarsMaterial.uniforms.uLayerTint.value as THREE.Color
      ).clone(),
    };

    const nexusCenter = new THREE.Vector3(0.35, 0.05, -0.15);
    const nexusGroup = new THREE.Group();
    nexusGroup.position.copy(nexusCenter);
    world.add(nexusGroup);

    const nexusShells: NexusShell[] = [];
    const nexusRings: NexusRing[] = [];
    const satellites: Satellite[] = [];
    const inboundLanes: InboundLane[] = [];
    const travelingPulses: TravelingPulse[] = [];
    const railShots: RailShot[] = [];
    const lightningArcs: LightningArc[] = [];
    const activationWaves: ActivationWave[] = [];
    const supernovaWaves: SupernovaWave[] = [];
    const sweepBeams: SweepBeam[] = [];
    const floatingGlyphs: FloatingGlyph[] = [];

    const coreGlowMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.violet,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const coreGlow = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(1.9, 36, 28)),
      coreGlowMaterial,
    );
    nexusGroup.add(coreGlow);

    const coreSolidMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x05060f,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    const coreSolid = new THREE.Mesh(
      trackGeometry(new THREE.IcosahedronGeometry(0.86, 2)),
      coreSolidMaterial,
    );
    coreSolid.renderOrder = 2;
    nexusGroup.add(coreSolid);
    const coreGlowBaseColor = coreGlowMaterial.color.clone();
    const coreSolidBaseColor = coreSolidMaterial.color.clone();

    const coreEnergyMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.white,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const coreEnergy = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(0.3, 18, 12)),
      coreEnergyMaterial,
    );
    coreEnergy.renderOrder = 5;
    nexusGroup.add(coreEnergy);
    const coreEnergyHaloMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const coreEnergyHalo = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(0.62, 20, 14)),
      coreEnergyHaloMaterial,
    );
    coreEnergyHalo.renderOrder = 4;
    nexusGroup.add(coreEnergyHalo);
    const coreEnergyBaseColor = coreEnergyMaterial.color.clone();
    const coreEnergyHaloBaseColor = coreEnergyHaloMaterial.color.clone();

    const shellSpecs = [
      {
        geometry: trackGeometry(new THREE.IcosahedronGeometry(1.16, 2)),
        color: COLORS.violet,
        opacity: 0.82,
        spin: new THREE.Vector3(0.1, 0.15, 0.04),
        wobble: 0.05,
      },
      {
        geometry: trackGeometry(new THREE.OctahedronGeometry(1.36, 2)),
        color: COLORS.pink,
        opacity: 0.52,
        spin: new THREE.Vector3(-0.08, 0.12, -0.05),
        wobble: 0.07,
      },
      {
        geometry: trackGeometry(new THREE.IcosahedronGeometry(1.56, 1)),
        color: COLORS.violet,
        opacity: 0.38,
        spin: new THREE.Vector3(0.06, -0.09, 0.08),
        wobble: 0.04,
      },
    ];

    shellSpecs.forEach((spec) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.color,
          wireframe: true,
          transparent: true,
          opacity: spec.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(spec.geometry, material);
      nexusGroup.add(mesh);
      nexusShells.push({
        mesh,
        material,
        spin: spec.spin,
        wobble: spec.wobble,
        baseRotation: mesh.rotation.clone(),
        baseColor: material.color.clone(),
      });
    });

    const ringSpecs = [
      {
        radius: 2.15,
        tube: 0.03,
        tilt: new THREE.Euler(0.3, 0.15, 0.44),
        color: COLORS.cyan,
        spin: 0.2,
      },
      {
        radius: 2.45,
        tube: 0.02,
        tilt: new THREE.Euler(1.0, 0.2, 0.2),
        color: COLORS.pink,
        spin: -0.17,
      },
      {
        radius: 2.75,
        tube: 0.015,
        tilt: new THREE.Euler(0.8, 0.62, 0.95),
        color: COLORS.orange,
        spin: 0.11,
      },
    ];

    ringSpecs.forEach((spec, index) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.44 - index * 0.06,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(
        trackGeometry(new THREE.TorusGeometry(spec.radius, spec.tube, 12, 140)),
        material,
      );
      mesh.rotation.copy(spec.tilt);
      nexusGroup.add(mesh);
      nexusRings.push({
        mesh,
        material,
        spin: spec.spin,
        pulsePhase: Math.random() * Math.PI * 2,
        baseRotation: mesh.rotation.clone(),
        baseColor: material.color.clone(),
      });
    });

    const satellitePositions = [
      {
        radius: 3.3,
        speed: 0.26,
        phase: 0.2,
        drift: 0.45,
        color: COLORS.orange,
      },
      {
        radius: 3.8,
        speed: -0.19,
        phase: 2.4,
        drift: -0.38,
        color: COLORS.pink,
      },
      {
        radius: 4.15,
        speed: 0.14,
        phase: 4.6,
        drift: 0.32,
        color: COLORS.cyan,
      },
    ];

    satellitePositions.forEach(({ radius, speed, phase, drift, color }) => {
      const group = new THREE.Group();
      world.add(group);

      const shellMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      const shell = new THREE.Mesh(
        trackGeometry(new THREE.IcosahedronGeometry(0.3, 1)),
        shellMaterial,
      );
      const glow = new THREE.Mesh(
        trackGeometry(new THREE.SphereGeometry(0.56, 20, 14)),
        glowMaterial,
      );
      group.add(shell, glow);

      const basePosition = new THREE.Vector3(
        nexusCenter.x + Math.cos(phase) * radius,
        nexusCenter.y + Math.sin(phase * 0.82) * drift,
        -0.9 + Math.sin(phase * 0.6) * 0.7,
      );
      group.position.copy(basePosition);

      satellites.push({
        group,
        shell,
        shellMaterial,
        glowMaterial,
        orbitRadius: radius,
        orbitSpeed: speed,
        orbitPhase: phase,
        yDrift: drift,
        basePosition,
        baseShellRotation: shell.rotation.clone(),
        baseShellColor: shellMaterial.color.clone(),
        baseGlowColor: glowMaterial.color.clone(),
      });
    });

    const createInboundCurve = (
      edge: THREE.Vector3,
      controlA: THREE.Vector3,
      controlB: THREE.Vector3,
      port: THREE.Vector3,
    ) =>
      new THREE.CatmullRomCurve3(
        [edge, controlA, controlB, port],
        false,
        "catmullrom",
        0.42,
      );

    const pulseCoreGeometry = trackGeometry(
      new THREE.SphereGeometry(0.13, 10, 8),
    );
    const pulseGlowGeometry = trackGeometry(
      new THREE.SphereGeometry(0.35, 12, 10),
    );
    const nexusPulseCoreMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.pink,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const nexusPulseCore = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(0.22, 20, 14)),
      nexusPulseCoreMaterial,
    );
    const nexusPulseGlowMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.violet,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const nexusPulseGlow = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(0.5, 20, 14)),
      nexusPulseGlowMaterial,
    );
    nexusGroup.add(nexusPulseGlow, nexusPulseCore);

    const createInboundLane = (
      curve: THREE.Curve<THREE.Vector3>,
      color: number,
      radius: number,
      travelRate: number,
      pulseOffset: number,
      pulseBoost: number,
    ) => {
      const outerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const innerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      const outerMesh = new THREE.Mesh(
        trackGeometry(
          new THREE.TubeGeometry(curve, 160, radius * 2.4, 7, false),
        ),
        outerMaterial,
      );
      const innerMesh = new THREE.Mesh(
        trackGeometry(new THREE.TubeGeometry(curve, 160, radius, 6, false)),
        innerMaterial,
      );
      world.add(outerMesh, innerMesh);

      const lane: InboundLane = {
        curve,
        innerMaterial,
        outerMaterial,
        baseInnerOpacity: innerMaterial.opacity,
        baseOuterOpacity: outerMaterial.opacity,
        travelRate,
        pulseBoost,
        baseInnerColor: innerMaterial.color.clone(),
        baseOuterColor: outerMaterial.color.clone(),
      };
      inboundLanes.push(lane);

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      [pulseOffset, pulseOffset + 0.46].forEach((offset) => {
        const core = new THREE.Mesh(pulseCoreGeometry, coreMaterial);
        const glow = new THREE.Mesh(pulseGlowGeometry, glowMaterial);
        world.add(core, glow);
        travelingPulses.push({
          core,
          glow,
          coreMaterial,
          glowMaterial,
          lane,
          offset,
          baseProgress: ((offset % 1) + 1) % 1,
          baseCoreColor: coreMaterial.color.clone(),
          baseGlowColor: glowMaterial.color.clone(),
        });
      });
    };

    const edgeSpecs = [
      {
        edge: new THREE.Vector3(-20, 4.8, -4.8),
        controlA: new THREE.Vector3(-12.5, 3.3, -2.2),
        controlB: new THREE.Vector3(-5.2, 2.5, -0.7),
        port: new THREE.Vector3(-1.45, 1.1, -0.08).add(nexusCenter),
        color: COLORS.cyan,
        radius: 0.012,
        speed: 0.18,
        offset: 0.06,
        pulseBoost: 1,
      },
      {
        edge: new THREE.Vector3(-20, 0.8, -4.2),
        controlA: new THREE.Vector3(-13, 0.75, -2.3),
        controlB: new THREE.Vector3(-5.6, 0.8, -0.75),
        port: new THREE.Vector3(-1.55, 0.12, -0.05).add(nexusCenter),
        color: COLORS.green,
        radius: 0.011,
        speed: 0.22,
        offset: 0.22,
        pulseBoost: 0.92,
      },
      {
        edge: new THREE.Vector3(-20, -4.8, -4.8),
        controlA: new THREE.Vector3(-12.5, -3.1, -2.1),
        controlB: new THREE.Vector3(-5.0, -1.85, -0.65),
        port: new THREE.Vector3(-1.35, -1.05, -0.05).add(nexusCenter),
        color: COLORS.pink,
        radius: 0.012,
        speed: 0.2,
        offset: 0.34,
        pulseBoost: 1,
      },
      {
        edge: new THREE.Vector3(-8.5, 15, -4.1),
        controlA: new THREE.Vector3(-6.0, 8.2, -2.2),
        controlB: new THREE.Vector3(-3.2, 3.8, -0.8),
        port: new THREE.Vector3(-0.55, 1.62, -0.02).add(nexusCenter),
        color: COLORS.orange,
        radius: 0.01,
        speed: 0.16,
        offset: 0.47,
        pulseBoost: 0.82,
      },
      {
        edge: new THREE.Vector3(0.7, 15, -4.2),
        controlA: new THREE.Vector3(0.5, 8.4, -2.3),
        controlB: new THREE.Vector3(0.25, 4.0, -0.86),
        port: new THREE.Vector3(0.1, 1.82, -0.02).add(nexusCenter),
        color: COLORS.violet,
        radius: 0.01,
        speed: 0.17,
        offset: 0.58,
        pulseBoost: 0.8,
      },
      {
        edge: new THREE.Vector3(16, 14, -4.5),
        controlA: new THREE.Vector3(10.5, 8.0, -2.4),
        controlB: new THREE.Vector3(4.8, 3.5, -0.9),
        port: new THREE.Vector3(1.15, 1.22, -0.02).add(nexusCenter),
        color: COLORS.orange,
        radius: 0.01,
        speed: 0.16,
        offset: 0.7,
        pulseBoost: 0.84,
      },
      {
        edge: new THREE.Vector3(18, -7.2, -4.5),
        controlA: new THREE.Vector3(11.2, -5.0, -2.4),
        controlB: new THREE.Vector3(5.0, -2.5, -0.9),
        port: new THREE.Vector3(1.2, -1.15, -0.02).add(nexusCenter),
        color: COLORS.violet,
        radius: 0.01,
        speed: 0.15,
        offset: 0.83,
        pulseBoost: 0.86,
      },
      {
        edge: new THREE.Vector3(0.7, -15, -4.0),
        controlA: new THREE.Vector3(0.5, -8.2, -2.2),
        controlB: new THREE.Vector3(0.25, -3.9, -0.8),
        port: new THREE.Vector3(0.05, -1.9, -0.02).add(nexusCenter),
        color: COLORS.pink,
        radius: 0.01,
        speed: 0.17,
        offset: 0.94,
        pulseBoost: 0.8,
      },
    ];

    edgeSpecs.forEach((spec) => {
      createInboundLane(
        createInboundCurve(spec.edge, spec.controlA, spec.controlB, spec.port),
        spec.color,
        spec.radius,
        spec.speed,
        spec.offset,
        spec.pulseBoost,
      );
    });

    // Helical signal paths use the same lane and pulse materials as the primary transmissions.
    const createHelixSignalCurve = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      turns: number,
      radius: number,
    ) => {
      const forward = end.clone().sub(start).normalize();
      const axis =
        Math.abs(forward.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(forward, axis).normalize();
      const up = new THREE.Vector3().crossVectors(side, forward).normalize();
      const points: THREE.Vector3[] = [];
      for (let index = 0; index <= 72; index += 1) {
        const t = index / 72;
        const point = start.clone().lerp(end, t);
        const phase = t * Math.PI * 2 * turns;
        const taper = THREE.MathUtils.lerp(radius, radius * 0.18, t);
        point.addScaledVector(side, Math.cos(phase) * taper);
        point.addScaledVector(up, Math.sin(phase) * taper);
        points.push(point);
      }
      return new THREE.CatmullRomCurve3(points);
    };

    [
      {
        start: new THREE.Vector3(-17, 6.2, -3.6),
        end: new THREE.Vector3(-0.72, 1.45, -0.12).add(nexusCenter),
        color: COLORS.cyan,
        offset: 0.08,
      },
      {
        start: new THREE.Vector3(16.5, 5.4, -4.1),
        end: new THREE.Vector3(0.72, 1.5, -0.12).add(nexusCenter),
        color: COLORS.orange,
        offset: 0.31,
      },
      {
        start: new THREE.Vector3(-15.8, -6.1, -4.4),
        end: new THREE.Vector3(-0.72, -1.5, -0.12).add(nexusCenter),
        color: COLORS.pink,
        offset: 0.55,
      },
      {
        start: new THREE.Vector3(17.2, -5.8, -3.8),
        end: new THREE.Vector3(0.72, -1.45, -0.12).add(nexusCenter),
        color: COLORS.violet,
        offset: 0.78,
      },
    ].forEach((spec) => {
      createInboundLane(
        createHelixSignalCurve(spec.start, spec.end, 4.6, 0.26),
        spec.color,
        0.012,
        0.18,
        spec.offset,
        0.92,
      );
    });

    const activationWaveGeometry = trackGeometry(
      new THREE.TorusGeometry(3.2, 0.03, 8, 180),
    );
    [
      { color: COLORS.cyan, delay: 0 },
      { color: COLORS.pink, delay: 0.14 },
      { color: COLORS.violet, delay: 0.26 },
    ].forEach(({ color, delay }) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(activationWaveGeometry, material);
      mesh.position.copy(nexusCenter);
      mesh.scale.set(1, 0.62, 1);
      mesh.visible = false;
      world.add(mesh);
      activationWaves.push({ mesh, material, delay });
    });

    const supernovaWaveGeometry = trackGeometry(
      new THREE.TorusGeometry(1, 0.045, 10, 160),
    );
    [COLORS.violet, COLORS.cyan, COLORS.pink].forEach((color, index) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(supernovaWaveGeometry, material);
      mesh.position.copy(nexusCenter);
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      world.add(mesh);
      supernovaWaves.push({ mesh, material, delay: index * 0.1 });
    });

    const buildHelixCurve = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      turns: number,
      radius: number,
      pointsCount: number,
    ) => {
      const forward = end.clone().sub(start).normalize();
      const axisRef =
        Math.abs(forward.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3()
        .crossVectors(forward, axisRef)
        .normalize();
      const up = new THREE.Vector3().crossVectors(side, forward).normalize();
      const points: THREE.Vector3[] = [];

      for (let i = 0; i <= pointsCount; i += 1) {
        const t = i / pointsCount;
        const point = start.clone().lerp(end, t);
        const phase = t * Math.PI * 2 * turns;
        const tapered = THREE.MathUtils.lerp(radius, radius * 0.25, t);
        point.addScaledVector(side, Math.cos(phase) * tapered);
        point.addScaledVector(up, Math.sin(phase) * tapered);
        points.push(point);
      }

      return new THREE.CatmullRomCurve3(points);
    };

    const railSpecs = [
      {
        start: new THREE.Vector3(-11.7, 4.0, -3.8),
        end: new THREE.Vector3(-0.4, 0.9, -0.14).add(nexusCenter),
        glow: COLORS.cyan,
        accent: COLORS.green,
        turns: 5.8,
        radius: 0.17,
      },
      {
        start: new THREE.Vector3(-11.5, -3.7, -3.8),
        end: new THREE.Vector3(-0.45, -0.9, -0.14).add(nexusCenter),
        glow: COLORS.pink,
        accent: COLORS.orange,
        turns: 6.2,
        radius: 0.16,
      },
      {
        start: new THREE.Vector3(8.4, 7.2, -3.8),
        end: new THREE.Vector3(0.88, 1.24, -0.14).add(nexusCenter),
        glow: COLORS.orange,
        accent: COLORS.violet,
        turns: 5.5,
        radius: 0.15,
      },
      {
        start: new THREE.Vector3(8.1, -4.8, -3.8),
        end: new THREE.Vector3(0.9, -1.05, -0.14).add(nexusCenter),
        glow: COLORS.violet,
        accent: COLORS.cyan,
        turns: 5.7,
        radius: 0.15,
      },
    ];

    railSpecs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.visible = false;
      world.add(group);

      const straightCurve = new THREE.LineCurve3(spec.start, spec.end);
      const helixCurve = buildHelixCurve(
        spec.start,
        spec.end,
        spec.turns,
        spec.radius,
        180,
      );

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.white,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.glow,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const helixMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.accent,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      group.add(
        new THREE.Mesh(
          trackGeometry(
            new THREE.TubeGeometry(straightCurve, 16, 0.05, 7, false),
          ),
          glowMaterial,
        ),
        new THREE.Mesh(
          trackGeometry(
            new THREE.TubeGeometry(straightCurve, 16, 0.013, 6, false),
          ),
          coreMaterial,
        ),
        new THREE.Mesh(
          trackGeometry(
            new THREE.TubeGeometry(helixCurve, 180, 0.015, 6, false),
          ),
          helixMaterial,
        ),
      );

      railShots.push({
        group,
        coreMaterial,
        glowMaterial,
        helixMaterial,
        cycleRate: 0.16 + (index % 3) * 0.02,
        cycleOffset: index * 0.21,
        duty: 0.08,
        readyEnabled: index === 0,
        baseCoreColor: coreMaterial.color.clone(),
        baseGlowColor: glowMaterial.color.clone(),
        baseHelixColor: helixMaterial.color.clone(),
      });
    });

    const arcPairs = [
      {
        start: new THREE.Vector3(-5.9, 5.1, -2.2),
        end: new THREE.Vector3(-2.6, 2.1, -0.65),
        color: COLORS.cyan,
      },
      {
        start: new THREE.Vector3(5.2, 4.8, -2.2),
        end: new THREE.Vector3(2.2, 1.7, -0.6),
        color: COLORS.orange,
      },
      {
        start: new THREE.Vector3(4.9, -4.2, -2.2),
        end: new THREE.Vector3(1.9, -1.7, -0.6),
        color: COLORS.violet,
      },
    ];

    arcPairs.forEach((spec, index) => {
      const points = [
        spec.start,
        spec.start
          .clone()
          .lerp(spec.end, 0.35)
          .add(new THREE.Vector3(0.2, 0.9, 0)),
        spec.start
          .clone()
          .lerp(spec.end, 0.66)
          .add(new THREE.Vector3(-0.22, -0.45, 0.15)),
        spec.end,
      ];
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        "catmullrom",
        0.8,
      );
      const geometry = trackGeometry(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
      );
      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const line = new THREE.Line(geometry, material);
      world.add(line);
      lightningArcs.push({
        line,
        material,
        points,
        jitter: 0.24 + index * 0.07,
        phase: Math.random() * Math.PI * 2,
        baseColor: material.color.clone(),
      });
    });

    const sweepGeometryCore = trackGeometry(
      new THREE.CylinderGeometry(0.008, 0.008, 14.5, 6, 1, true),
    );
    const sweepGeometryGlow = trackGeometry(
      new THREE.CylinderGeometry(0.036, 0.036, 14.5, 6, 1, true),
    );
    [
      { y: 3.2, phase: 0.4, speed: 0.64, color: COLORS.cyan },
      { y: -3.25, phase: 2.5, speed: 0.49, color: COLORS.pink },
    ].forEach(({ y, phase, speed, color }) => {
      const group = new THREE.Group();
      group.position.set(nexusCenter.x, y, -4.7);
      world.add(group);

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.white,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      const glow = new THREE.Mesh(sweepGeometryGlow, glowMaterial);
      const core = new THREE.Mesh(sweepGeometryCore, coreMaterial);
      glow.rotation.z = Math.PI / 2;
      core.rotation.z = Math.PI / 2;
      group.add(glow, core);

      sweepBeams.push({
        group,
        coreMaterial,
        glowMaterial,
        baseY: y,
        phase,
        speed,
        baseRotationZ: group.rotation.z,
        baseCoreColor: coreMaterial.color.clone(),
        baseGlowColor: glowMaterial.color.clone(),
      });
    });

    const glyphGeometry = trackGeometry(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.14, -0.14, 0),
        new THREE.Vector3(0.14, -0.14, 0),
        new THREE.Vector3(0.14, 0.14, 0),
        new THREE.Vector3(-0.14, 0.14, 0),
      ]),
    );

    const glyphColors = [
      COLORS.cyan,
      COLORS.orange,
      COLORS.pink,
      COLORS.violet,
    ];
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (5.2 + Math.random() * 2.1);
      const y = (Math.random() - 0.5) * 5.4;

      if (inQuietZone(x, y)) {
        continue;
      }

      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color: glyphColors[i % glyphColors.length],
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );

      const mesh = new THREE.LineLoop(glyphGeometry, material);
      const basePosition = new THREE.Vector3(x, y, -2.2 - Math.random() * 2.2);
      mesh.position.copy(basePosition);
      mesh.scale.setScalar(0.25 + Math.random() * 0.55);
      mesh.rotation.z = Math.random() * Math.PI;
      world.add(mesh);
      floatingGlyphs.push({
        mesh,
        material,
        basePosition,
        phase: Math.random() * Math.PI * 2,
        baseRotationZ: mesh.rotation.z,
        baseColor: material.color.clone(),
      });
    }

    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const colorScratchA = new THREE.Color();
    const colorScratchB = new THREE.Color();
    const colorScratchC = new THREE.Color();
    const paletteNeonGreen = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.neonGreen,
    );
    const paletteCyan = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.cyan,
    );
    const paletteSalmon = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.salmon,
    );
    const paletteViolet = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.violet,
    );
    const paletteAmber = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.amber,
    );
    const paletteAuthoredWhite = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.authoredWhite,
    );
    const paletteDeepTeal = new THREE.Color(
      COSMIC_NEXUS_CHROMA_TUNING.palette.deepTeal,
    );
    const ringCyclePalette = [
      paletteCyan,
      paletteViolet,
      paletteSalmon,
      paletteNeonGreen,
    ] as const;
    const laneCyclePalette = [
      paletteNeonGreen,
      paletteCyan,
      paletteSalmon,
      paletteAmber,
    ] as const;
    const starCyclePalette = [
      paletteCyan,
      paletteSalmon,
      paletteNeonGreen,
      paletteViolet,
    ] as const;

    const samplePaletteLoop = (
      palette: readonly THREE.Color[],
      t: number,
      out: THREE.Color,
    ) => {
      const paletteLength = palette.length;
      const wrapped = ((t % 1) + 1) % 1;
      const scaled = wrapped * paletteLength;
      const fromIndex = Math.floor(scaled) % paletteLength;
      const toIndex = (fromIndex + 1) % paletteLength;
      const alpha = scaled - fromIndex;
      return out.copy(palette[fromIndex]).lerpHSL(palette[toIndex], alpha);
    };

    const applyReactiveChromaFamilies = (
      chromaReactiveActive: boolean,
      reactiveGlobal: number,
      reactiveCore: number,
      reactiveParticles: number,
      bassSignal: number,
      midsSignal: number,
      highsSignal: number,
      energySignal: number,
      kickSignal: number,
      kickAccent: number,
      ringDriftPhase: number,
      auraBass: number,
      starHigh: number,
    ) => {
      if (!chromaReactiveActive) {
        coreGlowMaterial.color.copy(coreGlowBaseColor);
        coreSolidMaterial.color.copy(coreSolidBaseColor);
        coreEnergyMaterial.color.copy(coreEnergyBaseColor);
        coreEnergyHaloMaterial.color.copy(coreEnergyHaloBaseColor);

        nexusShells.forEach(({ material, baseColor }) => {
          material.color.copy(baseColor);
        });

        nexusRings.forEach(({ material, baseColor }) => {
          material.color.copy(baseColor);
        });

        satellites.forEach(
          ({ shellMaterial, glowMaterial, baseShellColor, baseGlowColor }) => {
            shellMaterial.color.copy(baseShellColor);
            glowMaterial.color.copy(baseGlowColor);
          },
        );

        inboundLanes.forEach((lane) => {
          lane.innerMaterial.color.copy(lane.baseInnerColor);
          lane.outerMaterial.color.copy(lane.baseOuterColor);
        });

        travelingPulses.forEach((pulse) => {
          pulse.coreMaterial.color.copy(pulse.baseCoreColor);
          pulse.glowMaterial.color.copy(pulse.baseGlowColor);
        });

        railShots.forEach((shot) => {
          shot.coreMaterial.color.copy(shot.baseCoreColor);
          shot.glowMaterial.color.copy(shot.baseGlowColor);
          shot.helixMaterial.color.copy(shot.baseHelixColor);
        });

        lightningArcs.forEach((arc) => {
          arc.material.color.copy(arc.baseColor);
        });

        sweepBeams.forEach((beam) => {
          beam.coreMaterial.color.copy(beam.baseCoreColor);
          beam.glowMaterial.color.copy(beam.baseGlowColor);
        });

        floatingGlyphs.forEach((glyph) => {
          glyph.material.color.copy(glyph.baseColor);
        });

        (distantStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
          starBaseColors.distant,
        );
        (accentStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
          starBaseColors.accent,
        );
        (brightStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
          starBaseColors.bright,
        );
        return;
      }

      const globalLift = THREE.MathUtils.clamp(reactiveGlobal, 0, 1);
      const bassLift = THREE.MathUtils.clamp(bassSignal, 0, 1);
      const midsLift = THREE.MathUtils.clamp(midsSignal, 0, 1);
      const highsLift = THREE.MathUtils.clamp(highsSignal, 0, 1);
      const energyLift = THREE.MathUtils.clamp(energySignal, 0, 1);
      const kickSignalLift = THREE.MathUtils.clamp(kickSignal, 0, 1);
      const kickAccentLift = THREE.MathUtils.clamp(kickAccent, 0, 1);
      const auraBassLift = THREE.MathUtils.clamp(auraBass, 0, 1);
      const starHighLift = THREE.MathUtils.clamp(starHigh, 0, 1);

      // Central aura: bass breathes between deep teal/cyan and violet/salmon; brightness remains separate and restrained.
      const auraMix = THREE.MathUtils.lerp(
        COSMIC_NEXUS_CHROMA_TUNING.familyMix.aura.min,
        COSMIC_NEXUS_CHROMA_TUNING.familyMix.aura.max,
        auraBassLift,
      );
      colorScratchA
        .copy(paletteDeepTeal)
        .lerpHSL(paletteViolet, auraBassLift * 0.92);
      colorScratchA.lerpHSL(paletteSalmon, kickAccentLift * 0.26);
      coreGlowMaterial.color.copy(
        colorScratchB.copy(coreGlowBaseColor).lerpHSL(colorScratchA, auraMix),
      );
      coreSolidMaterial.color.copy(
        colorScratchC
          .copy(coreSolidBaseColor)
          .lerpHSL(paletteViolet, energyLift * 0.12),
      );
      coreEnergyMaterial.color.copy(
        colorScratchA
          .copy(coreEnergyBaseColor)
          .lerpHSL(paletteCyan, kickSignalLift * 0.08),
      );
      coreEnergyHaloMaterial.color.copy(
        colorScratchB
          .copy(coreEnergyHaloBaseColor)
          .lerpHSL(paletteViolet, auraBassLift * 0.3),
      );

      // Ring family: slower mids-driven cycle through cyan, violet, salmon, green.
      nexusRings.forEach(({ material, baseColor }, index) => {
        const ringPhase = ringDriftPhase + index * 0.19 + midsLift * 0.18;
        const ringMix = THREE.MathUtils.lerp(
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.ring.min,
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.ring.max,
          midsLift,
        );
        samplePaletteLoop(ringCyclePalette, ringPhase, colorScratchA);
        colorScratchA.lerpHSL(paletteSalmon, kickAccentLift * 0.12);
        material.color.copy(
          colorScratchB.copy(baseColor).lerpHSL(colorScratchA, ringMix),
        );
      });

      // Wireframe shells: separate mids drift path with restrained energy accent to keep readability.
      nexusShells.forEach(({ material, baseColor }, index) => {
        const shellPhase =
          ringDriftPhase * 0.78 + index * 0.27 + reactiveCore * 0.14;
        const shellMix = THREE.MathUtils.lerp(
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.shell.min,
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.shell.max,
          Math.min(1, midsLift * 0.78 + reactiveCore * 0.22),
        );
        samplePaletteLoop(ringCyclePalette, shellPhase, colorScratchA);
        colorScratchA.lerpHSL(paletteNeonGreen, energyLift * 0.15);
        material.color.copy(
          colorScratchB.copy(baseColor).lerpHSL(colorScratchA, shellMix),
        );
      });

      // Satellites/orbs: kick delivers brief unmistakable contrast transitions per-orb.
      satellites.forEach(
        (
          { shellMaterial, glowMaterial, baseShellColor, baseGlowColor },
          index,
        ) => {
          const kickTarget =
            index % 3 === 0
              ? paletteSalmon
              : index % 3 === 1
                ? paletteCyan
                : paletteSalmon;
          const driftTarget =
            index % 3 === 0
              ? paletteViolet
              : index % 3 === 1
                ? paletteNeonGreen
                : paletteAmber;
          const shellKickMix = THREE.MathUtils.lerp(
            COSMIC_NEXUS_CHROMA_TUNING.familyMix.pulseKick.min,
            COSMIC_NEXUS_CHROMA_TUNING.familyMix.pulseKick.max,
            kickAccentLift,
          );

          colorScratchA
            .copy(baseShellColor)
            .lerpHSL(driftTarget, midsLift * 0.24);
          shellMaterial.color.copy(
            colorScratchB.copy(colorScratchA).lerpHSL(kickTarget, shellKickMix),
          );

          colorScratchC
            .copy(baseGlowColor)
            .lerpHSL(kickTarget, 0.3 + kickAccentLift * 0.24);
          glowMaterial.color.copy(colorScratchC);
        },
      );

      // Signal lanes and path lines: highs+energy drive palette travel through green/cyan/salmon/amber.
      inboundLanes.forEach((lane, index) => {
        const lanePhase =
          ringDriftPhase * 0.46 +
          index * 0.11 +
          highsLift * 0.24 +
          energyLift * 0.1;
        const laneMix = THREE.MathUtils.lerp(
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.lane.min,
          COSMIC_NEXUS_CHROMA_TUNING.familyMix.lane.max,
          Math.min(1, highsLift * 0.68 + energyLift * 0.32),
        );
        samplePaletteLoop(laneCyclePalette, lanePhase, colorScratchA);
        lane.innerMaterial.color.copy(
          colorScratchB
            .copy(lane.baseInnerColor)
            .lerpHSL(colorScratchA, laneMix),
        );
        lane.outerMaterial.color.copy(
          colorScratchC
            .copy(lane.baseOuterColor)
            .lerpHSL(colorScratchA, laneMix * 0.8),
        );
      });

      // Traveling packets: kick can briefly recolor packet body itself, not only opacity/size.
      travelingPulses.forEach((pulse, index) => {
        const packetTarget =
          index % 3 === 0
            ? paletteSalmon
            : index % 3 === 1
              ? paletteAmber
              : paletteNeonGreen;
        colorScratchA
          .copy(pulse.baseCoreColor)
          .lerpHSL(packetTarget, 0.26 + kickAccentLift * 0.58);
        pulse.coreMaterial.color.copy(colorScratchA);

        samplePaletteLoop(
          laneCyclePalette,
          ringDriftPhase * 0.5 + index * 0.17 + highsLift * 0.18,
          colorScratchB,
        );
        pulse.glowMaterial.color.copy(
          colorScratchC
            .copy(pulse.baseGlowColor)
            .lerpHSL(colorScratchB, 0.34 + highsLift * 0.18),
        );
      });

      // Fine details: restrained authored-white accents on selected cores only.
      railShots.forEach((shot, index) => {
        const accent = index % 2 === 0 ? paletteViolet : paletteCyan;
        shot.coreMaterial.color.copy(
          colorScratchA
            .copy(shot.baseCoreColor)
            .lerpHSL(paletteAuthoredWhite, 0.08 + kickSignalLift * 0.16),
        );
        shot.glowMaterial.color.copy(
          colorScratchB
            .copy(shot.baseGlowColor)
            .lerpHSL(accent, 0.3 + highsLift * 0.22),
        );
        shot.helixMaterial.color.copy(
          colorScratchC
            .copy(shot.baseHelixColor)
            .lerpHSL(paletteAmber, 0.18 + highsLift * 0.24),
        );
      });

      lightningArcs.forEach((arc) => {
        const lightningAccent = highsLift > 0.5 ? paletteSalmon : paletteCyan;
        arc.material.color.copy(
          colorScratchA
            .copy(arc.baseColor)
            .lerpHSL(lightningAccent, 0.2 + highsLift * 0.32),
        );
      });

      sweepBeams.forEach((beam, index) => {
        const accent = index % 2 === 0 ? paletteCyan : paletteSalmon;
        beam.coreMaterial.color.copy(
          colorScratchA
            .copy(beam.baseCoreColor)
            .lerpHSL(paletteAuthoredWhite, 0.06 + kickAccentLift * 0.1),
        );
        beam.glowMaterial.color.copy(
          colorScratchB
            .copy(beam.baseGlowColor)
            .lerpHSL(accent, 0.24 + bassLift * 0.24),
        );
      });

      floatingGlyphs.forEach((glyph, index) => {
        const accent = index % 2 === 0 ? paletteViolet : paletteAmber;
        glyph.material.color.copy(
          colorScratchA
            .copy(glyph.baseColor)
            .lerpHSL(accent, 0.2 + highsLift * 0.22 + midsLift * 0.1),
        );
      });

      // Stars: restrained but visible highs-driven hue shimmer.
      const starMix = THREE.MathUtils.lerp(
        COSMIC_NEXUS_CHROMA_TUNING.familyMix.stars.min,
        COSMIC_NEXUS_CHROMA_TUNING.familyMix.stars.max,
        starHighLift,
      );
      samplePaletteLoop(
        starCyclePalette,
        ringDriftPhase * 0.34 + starHighLift * 0.2,
        colorScratchA,
      );
      (distantStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
        colorScratchB
          .copy(starBaseColors.distant)
          .lerpHSL(colorScratchA, starMix * 0.5),
      );
      samplePaletteLoop(
        starCyclePalette,
        ringDriftPhase * 0.51 + globalLift * 0.14,
        colorScratchB,
      );
      (accentStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
        colorScratchC
          .copy(starBaseColors.accent)
          .lerpHSL(colorScratchB, starMix),
      );
      samplePaletteLoop(
        starCyclePalette,
        ringDriftPhase * 0.68 + reactiveParticles * 0.22,
        colorScratchC,
      );
      (brightStarsMaterial.uniforms.uLayerTint.value as THREE.Color).copy(
        colorScratchA
          .copy(starBaseColors.bright)
          .lerpHSL(colorScratchC, starMix * 0.9),
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", handlePointerMove);

    const applyResponsiveLayout = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / Math.max(height, 1);

      if (width < 640) {
        world.scale.setScalar(0.66);
        world.position.set(0.16, -0.14, 0);
        camera.fov = 68;
      } else if (width < 1000 || aspect < 1.28) {
        world.scale.setScalar(0.82);
        world.position.set(0.13, 0.0, 0);
        camera.fov = 63;
      } else {
        world.scale.setScalar(1);
        world.position.set(0.1, 0.12, 0);
        camera.fov = 58;
      }

      camera.updateProjectionMatrix();
    };

    applyResponsiveLayout();

    const timer = new THREE.Timer();
    timer.connect(document);

    let elapsed = 0;
    let grayscaleMix = visualStateRef.current.isPlaying ? 0 : 1;
    let frameId = 0;
    let previousHasSignal = Boolean(visualStateRef.current.signalId);
    let previousPlaying = visualStateRef.current.isPlaying;
    let previousReactiveSignalId = visualStateRef.current.signalId;
    let previousKickAcceptedCount = 0;
    let previousKickAcceptedSequence = 0;
    let reactiveState = createNeutralSignalNexusReactiveState();
    let activationProgress = 1;
    let activationStrength = 0;
    let chromaKickAccent = 0;
    let chromaAuraBass = 0;
    let chromaStarHigh = 0;
    let chromaRingDriftPhase = 0;
    let sharedHueOffsetDegrees = 0;
    const surgeQualificationRef = {
      current: createSharedSurgeQualificationState(),
    };
    let supernovaAge = -1;

    const stepChromaEnvelope = (
      current: number,
      target: number,
      deltaSeconds: number,
      attackPerSecond: number,
      releasePerSecond: number,
    ) => {
      const safeDelta = Math.max(0, deltaSeconds);
      const rate = target > current ? attackPerSecond : releasePerSecond;
      const blend = 1 - Math.exp(-Math.max(0, rate) * safeDelta);
      return current + (target - current) * blend;
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      timer.update();

      const state = visualStateRef.current;
      const systemReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const reduced = state.reducedMotion || systemReducedMotion;
      const isPlaying = state.isPlaying === true;
      const chromaEnabled = state.chromaEnabled !== false;
      const hasSignal = Boolean(state.signalId);
      const motionEnabled = state.motionEnabled ?? true;
      const motionActive = isPlaying && motionEnabled;
      const playingMotionOff = isPlaying && !motionEnabled;
      const latestSnapshot =
        typeof state.getLatestAudioSnapshot === "function"
          ? state.getLatestAudioSnapshot()
          : null;
      const activeSnapshot =
        latestSnapshot?.isActive === true ? latestSnapshot : null;
      const volumeScale = 0.67 + state.volume * 0.33;
      const grayscaleTarget = isPlaying ? 0 : 1;
      const grayscaleLerp = reduced ? 1 : 0.08;

      grayscaleMix += (grayscaleTarget - grayscaleMix) * grayscaleLerp;
      if (Math.abs(grayscaleTarget - grayscaleMix) <= 0.001) {
        grayscaleMix = grayscaleTarget;
      }

      if (state.signalId !== previousReactiveSignalId) {
        previousReactiveSignalId = state.signalId;
        previousKickAcceptedCount =
          activeSnapshot?.kickPulseAcceptedEventCount ?? 0;
        previousKickAcceptedSequence =
          activeSnapshot?.kickPulseAcceptedEventSequence ?? 0;
        reactiveState = createNeutralSignalNexusReactiveState();
      }

      const playbackJustStarted = isPlaying && !previousPlaying;
      if (playbackJustStarted) {
        previousKickAcceptedCount =
          activeSnapshot?.kickPulseAcceptedEventCount ??
          previousKickAcceptedCount;
        previousKickAcceptedSequence =
          activeSnapshot?.kickPulseAcceptedEventSequence ??
          previousKickAcceptedSequence;
      }

      const nextKickAcceptedCount =
        activeSnapshot?.kickPulseAcceptedEventCount ??
        previousKickAcceptedCount;
      const nextKickAcceptedSequence =
        activeSnapshot?.kickPulseAcceptedEventSequence ??
        previousKickAcceptedSequence;
      const kickEdge =
        (!playbackJustStarted &&
          (activeSnapshot?.kickPulseAcceptedEvent ?? false)) ||
        nextKickAcceptedCount > previousKickAcceptedCount ||
        nextKickAcceptedSequence > previousKickAcceptedSequence;
      previousKickAcceptedCount = nextKickAcceptedCount;
      previousKickAcceptedSequence = nextKickAcceptedSequence;

      const delta = Math.min(timer.getDelta(), 0.05);
      const reactiveTarget = resolveSignalNexusReactiveTarget({
        isPlaying,
        chromaEnabled,
        snapshot: activeSnapshot,
        kickImpulseSeed: kickEdge ? 1 : (activeSnapshot?.kickPulse ?? 0),
      });
      reactiveState = stepSignalNexusReactiveState(
        reactiveState,
        reactiveTarget,
        delta,
      );

      const chromaReactiveActive = isPlaying && chromaEnabled;
      const energySignal = THREE.MathUtils.clamp(
        activeSnapshot?.smoothedEnergy ?? 0,
        0,
        1,
      );
      const nexusIntensity = energySignal;
      const bassSignal = THREE.MathUtils.clamp(activeSnapshot?.bass ?? 0, 0, 1);
      const midsSignal = THREE.MathUtils.clamp(activeSnapshot?.mids ?? 0, 0, 1);
      const highsSignal = THREE.MathUtils.clamp(
        activeSnapshot?.highs ?? 0,
        0,
        1,
      );
      const kickSignal = THREE.MathUtils.clamp(
        activeSnapshot?.kickPulse ?? 0,
        0,
        1,
      );

      const sharedHueTargetDegrees = chromaReactiveActive
        ? mapSignalRunnerChromaHue(energySignal)
        : 0;
      sharedHueOffsetDegrees +=
        (sharedHueTargetDegrees - sharedHueOffsetDegrees) *
        SIGNAL_RUNNER_CHROMA_HUE_RESPONSE;
      if (!chromaReactiveActive && Math.abs(sharedHueOffsetDegrees) < 0.05) {
        sharedHueOffsetDegrees = 0;
      }

      const qualification = updateSharedSurgeQualification(
        surgeQualificationRef.current,
        {
          nowMs: performance.now(),
          smoothedEnergy: energySignal,
          acceptedSequence: activeSnapshot?.kickPulseAcceptedEventSequence ?? 0,
          isPlaying,
          motionEnabled,
        },
      );
      surgeQualificationRef.current = qualification.state;
      if (motionActive && qualification.triggered) {
        supernovaAge = 0;
      }
      if (motionActive && supernovaAge >= 0) {
        supernovaAge += delta;
        if (supernovaAge >= 2.4) supernovaAge = -1;
      }
      const supernovaProgress =
        supernovaAge < 0 ? 0 : Math.min(1, supernovaAge / 2.4);
      const supernovaEnvelope =
        supernovaAge < 0 ? 0 : Math.pow(1 - supernovaProgress, 1.35);

      if (isPlaying) {
        chromaRingDriftPhase =
          (chromaRingDriftPhase +
            delta *
              (COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.ringDriftBaseRate +
                midsSignal *
                  COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond
                    .ringDriftMidsRate)) %
          1;
      }

      chromaKickAccent = stepChromaEnvelope(
        chromaKickAccent,
        Math.max(kickSignal, reactiveState.kickImpulse),
        delta,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.kickAccent.attack,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.kickAccent.release,
      );
      chromaAuraBass = stepChromaEnvelope(
        chromaAuraBass,
        bassSignal,
        delta,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.auraBass.attack,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.auraBass.release,
      );
      chromaStarHigh = stepChromaEnvelope(
        chromaStarHigh,
        highsSignal,
        delta,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.starHigh.attack,
        COSMIC_NEXUS_CHROMA_TUNING.timingPerSecond.starHigh.release,
      );

      const saturationSource = THREE.MathUtils.clamp(
        (reactiveState.saturation -
          SIGNAL_NEXUS_REACTIVITY.bounds.saturation.min) /
          Math.max(
            SIGNAL_NEXUS_REACTIVITY.bounds.saturation.max -
              SIGNAL_NEXUS_REACTIVITY.bounds.saturation.min,
            0.0001,
          ),
        0,
        1,
      );
      const brightnessSource = THREE.MathUtils.clamp(
        (reactiveState.emissiveIntensity -
          SIGNAL_NEXUS_REACTIVITY.bounds.emissiveIntensity.min) /
          Math.max(
            SIGNAL_NEXUS_REACTIVITY.bounds.emissiveIntensity.max -
              SIGNAL_NEXUS_REACTIVITY.bounds.emissiveIntensity.min,
            0.0001,
          ),
        0,
        1,
      );

      const hueOffset = chromaReactiveActive
        ? sharedHueOffsetDegrees
        : COSMIC_NEXUS_NEUTRAL_HUE_OFFSET_DEGREES;
      const saturation = chromaReactiveActive
        ? THREE.MathUtils.lerp(
            COSMIC_NEXUS_CHROMA_TUNING.globalFilter.saturationMin,
            COSMIC_NEXUS_CHROMA_TUNING.globalFilter.saturationMax,
            saturationSource,
          )
        : COSMIC_NEXUS_NEUTRAL_SATURATION_MULTIPLIER;
      const emissive = chromaReactiveActive
        ? THREE.MathUtils.lerp(
            COSMIC_NEXUS_CHROMA_TUNING.globalFilter.brightnessMin,
            COSMIC_NEXUS_CHROMA_TUNING.globalFilter.brightnessMax,
            brightnessSource,
          )
        : COSMIC_NEXUS_NEUTRAL_EMISSIVE_MULTIPLIER;

      renderer.domElement.style.filter = [
        `grayscale(${grayscaleMix.toFixed(3)})`,
        `hue-rotate(${hueOffset.toFixed(3)}deg)`,
        `saturate(${saturation.toFixed(3)})`,
        `brightness(${emissive.toFixed(3)})`,
      ].join(" ");

      const kineticScale = reduced
        ? 0.12
        : playingMotionOff
          ? 0.16
          : 1 + nexusIntensity * 0.35;
      const trafficScale = reduced
        ? 0.05
        : playingMotionOff
          ? 0.16
          : 1 + nexusIntensity * 0.45;
      const burstEnabled = isPlaying && motionEnabled && !reduced;
      const dampedActiveScale = playingMotionOff ? 0.42 : 1.2;
      const reactiveGlobal = reactiveState.globalIntensity;
      const reactiveCore = reactiveState.corePulse;
      const reactiveKick = reactiveState.kickImpulse;
      const reactiveOrbit = reactiveState.orbitIntensity;
      const reactiveParticles = reactiveState.particleIntensity;
      const motionTuning = SIGNAL_NEXUS_REACTIVITY.motion;

      applyReactiveChromaFamilies(
        chromaReactiveActive,
        reactiveGlobal,
        reactiveCore,
        reactiveParticles,
        bassSignal,
        midsSignal,
        highsSignal,
        energySignal,
        kickSignal,
        chromaKickAccent,
        chromaRingDriftPhase + sharedHueOffsetDegrees / 360,
        chromaAuraBass,
        chromaStarHigh,
      );

      if (motionActive) {
        elapsed += delta * kineticScale;
      }

      if (!motionActive) {
        previousHasSignal = hasSignal;
        previousPlaying = isPlaying;
        activationProgress = 1;
        activationStrength = 0;
        supernovaWaves.forEach(({ mesh, material }) => {
          mesh.visible = false;
          material.opacity = 0;
        });

        // Freeze transforms/phases in-place. Only color/presentation may continue reacting while playing.
        if (isPlaying) {
          coreGlowMaterial.opacity =
            (0.28 + reactiveGlobal * 0.08 + reactiveKick * 0.06) * volumeScale;
        }

        if (!isPlaying) {
          activationWaves.forEach(({ material }) => {
            material.opacity = 0;
          });
          railShots.forEach((shot) => {
            shot.coreMaterial.opacity = 0;
            shot.glowMaterial.opacity = 0;
            shot.helixMaterial.opacity = 0;
          });
          lightningArcs.forEach((arc) => {
            arc.material.opacity = 0;
          });
          sweepBeams.forEach((beam) => {
            beam.coreMaterial.opacity = 0;
            beam.glowMaterial.opacity = 0;
          });
        }

        distantStarsMaterial.uniforms.uOpacity.value =
          starBaseOpacity.distant *
          (isPlaying ? 1 + reactiveParticles * 0.1 : 1);
        accentStarsMaterial.uniforms.uOpacity.value =
          starBaseOpacity.accent *
          (isPlaying ? 1 + reactiveParticles * 0.16 : 1);
        brightStarsMaterial.uniforms.uOpacity.value =
          starBaseOpacity.bright *
          (isPlaying ? 1 + reactiveParticles * 0.22 : 1);
        [
          distantStarsMaterial,
          accentStarsMaterial,
          brightStarsMaterial,
        ].forEach((material) => {
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uHueShift.value = chromaReactiveActive
            ? sharedHueOffsetDegrees / 360
            : 0;
          material.uniforms.uTwinkle.value = chromaReactiveActive ? 1 : 0.82;
          material.uniforms.uSurge.value = 0;
          material.uniforms.uSizeScale.value = 1;
        });

        renderer.render(scene, camera);
        return;
      }

      if (hasSignal && !previousHasSignal) {
        activationProgress = 0;
        activationStrength = 0.86;
      } else if (isPlaying && !previousPlaying) {
        activationProgress = 0;
        activationStrength = 1.4;
      } else if (!isPlaying && previousPlaying) {
        activationProgress = 0;
        activationStrength = 0.6;
      } else if (!hasSignal && previousHasSignal) {
        activationProgress = 0;
        activationStrength = 0.34;
      }

      previousHasSignal = hasSignal;
      previousPlaying = isPlaying;

      if (reduced) {
        activationProgress = 1;
      } else {
        activationProgress = Math.min(
          1,
          activationProgress + delta * (isPlaying ? 1.48 : 1.1),
        );
      }

      const transitionBoost =
        Math.max(0, 1 - activationProgress) * activationStrength;

      pointerCurrent.lerp(
        pointerTarget,
        reduced ? 0.01 : playingMotionOff ? 0.005 : 0.024,
      );
      world.rotation.y = pointerCurrent.x * 0.02;
      world.rotation.x = -pointerCurrent.y * 0.015;

      const corePulse = (Math.sin(elapsed * (isPlaying ? 2.8 : 1.1)) + 1) * 0.5;
      const coreReactiveScale =
        reactiveCore * motionTuning.coreBreathReactiveAmplitude +
        reactiveKick * motionTuning.coreKickImpulseAmplitude;
      coreGlow.scale.setScalar(
        1 +
          corePulse *
            (isPlaying
              ? motionTuning.coreBreathBaseAmplitude +
                coreReactiveScale +
                nexusIntensity * 0.08
              : 0.07),
      );
      coreGlowMaterial.opacity =
        (isPlaying
          ? 0.36 + reactiveGlobal * 0.08 + reactiveKick * 0.05
          : 0.07) *
          volumeScale +
        supernovaEnvelope * 0.42;
      const coreEnergyPulse = Math.max(
        corePulse,
        reactiveCore * 0.82,
        reactiveKick * 0.92,
      );
      const coreEnergyBurst = supernovaEnvelope + reactiveKick * 0.72;
      coreEnergy.scale.setScalar(
        (isPlaying ? 1 : 0.72) +
          coreEnergyPulse * (isPlaying ? 0.34 : 0.08) +
          supernovaEnvelope * 0.82,
      );
      coreEnergyHalo.scale.setScalar(
        (isPlaying ? 1 : 0.72) +
          coreEnergyPulse * 0.42 +
          supernovaEnvelope * 1.8,
      );
      coreEnergyMaterial.opacity = THREE.MathUtils.clamp(
        (isPlaying ? 0.9 + coreEnergyPulse * 0.1 : 0.52) * volumeScale +
          coreEnergyBurst * 0.18,
        0,
        1,
      );
      coreEnergyHaloMaterial.opacity = THREE.MathUtils.clamp(
        (isPlaying ? 0.18 + coreEnergyPulse * 0.12 : 0.08) * volumeScale +
          supernovaEnvelope * 0.46,
        0,
        0.82,
      );
      colorScratchA
        .copy(paletteSalmon)
        .offsetHSL(
          chromaReactiveActive ? sharedHueOffsetDegrees / 360 : 0,
          0,
          supernovaEnvelope * 0.08,
        );
      nexusPulseCoreMaterial.color.copy(colorScratchA);
      colorScratchB
        .copy(paletteViolet)
        .offsetHSL(
          chromaReactiveActive ? sharedHueOffsetDegrees / 360 : 0,
          0,
          supernovaEnvelope * 0.05,
        );
      nexusPulseGlowMaterial.color.copy(colorScratchB);
      nexusPulseCore.scale.setScalar(
        1 + kickSignal * 0.35 + supernovaEnvelope * 1.7,
      );
      nexusPulseGlow.scale.setScalar(
        1 + nexusIntensity * 0.4 + supernovaEnvelope * 3.2,
      );
      nexusPulseCoreMaterial.opacity = Math.min(
        1,
        0.78 + supernovaEnvelope * 0.22,
      );
      nexusPulseGlowMaterial.opacity = Math.min(
        0.82,
        0.18 + supernovaEnvelope * 0.58,
      );

      nexusShells.forEach(({ mesh, material, spin, wobble }, index) => {
        const spinFactor =
          (reduced ? 0.18 : playingMotionOff ? 0.2 : 1) *
          (1 + reactiveOrbit * motionTuning.shellSpinReactiveInfluence);
        mesh.rotation.x +=
          spin.x * delta * spinFactor * (0.62 + dampedActiveScale);
        mesh.rotation.y +=
          spin.y * delta * spinFactor * (0.62 + dampedActiveScale);
        mesh.rotation.z +=
          spin.z * delta * spinFactor * (0.62 + dampedActiveScale);
        const wobblePulse =
          1 +
          Math.sin(elapsed * (1.2 + index * 0.15) + index) *
            wobble *
            (1 + reactiveCore * 0.18);
        mesh.scale.setScalar(wobblePulse);
        material.opacity = THREE.MathUtils.clamp(
          (isPlaying ? 0.58 + reactiveGlobal * 0.08 : 0.22) +
            transitionBoost * 0.14 -
            index * 0.05,
          0.08,
          0.86,
        );
      });

      nexusRings.forEach(({ mesh, material, spin, pulsePhase }, index) => {
        const orbitRate =
          1 + reactiveOrbit * motionTuning.ringSpinReactiveInfluence;
        mesh.rotation.y +=
          spin * delta * kineticScale * (0.7 + dampedActiveScale) * orbitRate;
        mesh.rotation.x += spin * delta * kineticScale * 0.28 * orbitRate;
        const ringPulse =
          (Math.sin(elapsed * (1.5 + index * 0.25) + pulsePhase) + 1) * 0.5;
        const ringScale =
          1 +
          (isPlaying ? nexusIntensity * 0.035 + kickSignal * 0.06 : 0) *
            ringPulse +
          supernovaEnvelope * 0.9;
        mesh.scale.setScalar(ringScale);
        material.opacity =
          (isPlaying ? 0.38 + reactiveGlobal * 0.08 : 0.12) +
          ringPulse * (isPlaying ? 0.2 + reactiveKick * 0.04 : 0.08);
      });

      satellites.forEach((satellite, index) => {
        const orbitRate =
          motionTuning.satelliteOrbitBaseScale *
          (1 +
            reactiveOrbit * motionTuning.satelliteOrbitReactiveInfluence +
            reactiveGlobal * motionTuning.satelliteOrbitGlobalInfluence);
        const orbitAngle =
          elapsed * satellite.orbitSpeed * (isPlaying ? orbitRate : 0.4) +
          satellite.orbitPhase;
        const x = nexusCenter.x + Math.cos(orbitAngle) * satellite.orbitRadius;
        const y =
          nexusCenter.y + Math.sin(orbitAngle * 0.82) * satellite.yDrift;
        const z = -0.9 + Math.sin(orbitAngle * 0.6) * 0.7;

        satellite.group.position.set(x, y, z);
        const shellSpinRate =
          motionTuning.satelliteShellSpinBaseScale *
          (1 +
            reactiveOrbit * motionTuning.satelliteShellSpinReactiveInfluence);
        satellite.shell.rotation.x +=
          0.4 * delta * kineticScale * shellSpinRate;
        satellite.shell.rotation.y +=
          0.68 * delta * kineticScale * shellSpinRate;

        const pulse =
          (Math.sin(elapsed * (1.4 + index * 0.2) + satellite.orbitPhase) + 1) *
          0.5;
        satellite.shellMaterial.opacity =
          (isPlaying ? 0.56 + reactiveGlobal * 0.08 : 0.2) + pulse * 0.1;
        satellite.glowMaterial.opacity =
          (isPlaying ? 0.12 + reactiveParticles * 0.08 : 0.03) * volumeScale;
      });

      const lanePower =
        (isPlaying
          ? 1.5 + reactiveGlobal * 0.7 + reactiveParticles * 0.25
          : 0.14) +
        transitionBoost * 0.3;
      inboundLanes.forEach((lane) => {
        lane.outerMaterial.opacity = Math.min(
          1,
          lane.baseOuterOpacity * lanePower * volumeScale,
        );
        lane.innerMaterial.opacity = Math.min(
          1,
          lane.baseInnerOpacity * lanePower * volumeScale,
        );
      });

      travelingPulses.forEach(
        ({ core, glow, coreMaterial, glowMaterial, lane, offset }, index) => {
          const speed =
            lane.travelRate *
            (isPlaying ? motionTuning.travelerBaseRateScale : 0.15) *
            trafficScale *
            (1 + supernovaEnvelope * 1.1) *
            (1 +
              reactiveOrbit * motionTuning.travelerOrbitInfluence +
              reactiveGlobal * motionTuning.travelerGlobalInfluence);
          const progress = (elapsed * speed + offset) % 1;
          const point = lane.curve.getPointAt(progress);
          core.position.copy(point);
          glow.position.copy(point);

          const flicker =
            (Math.sin(elapsed * (3 + index * 0.3) + offset) + 1) * 0.5;
          const scale =
            0.86 +
            flicker *
              (motionTuning.travelerPulseBaseScale +
                reactiveKick * motionTuning.travelerPulseKickScale);
          core.scale.setScalar(scale);
          glow.scale.setScalar(
            scale *
              (isPlaying
                ? motionTuning.travelerGlowBaseScale +
                  reactiveParticles * motionTuning.travelerGlowParticleScale
                : 0.7),
          );

          const boost = isPlaying
            ? lane.pulseBoost + reactiveGlobal * 0.16
            : 0.25;
          coreMaterial.opacity = THREE.MathUtils.clamp(boost, 0.15, 1);
          glowMaterial.opacity =
            (isPlaying ? 0.3 + reactiveParticles * 0.1 : 0.03) *
            volumeScale *
            (1 + supernovaEnvelope * 1.4);
        },
      );

      activationWaves.forEach(({ mesh, material, delay }) => {
        const local = THREE.MathUtils.clamp(
          (activationProgress - delay) / Math.max(0.001, 1 - delay),
          0,
          1,
        );
        const active = activationProgress < 1 && local > 0 && local < 1;
        mesh.visible = active;

        if (!active) {
          material.opacity = 0;
          return;
        }

        const flare = Math.sin(local * Math.PI);
        mesh.scale.set(
          0.65 + local * 1.65,
          0.65 + local * 1.03,
          0.65 + local * 1.65,
        );
        material.opacity =
          flare *
          activationStrength *
          (0.38 + reactiveKick * 0.18) *
          volumeScale;
      });

      supernovaWaves.forEach(({ mesh, material, delay }) => {
        if (supernovaAge < 0 || !motionActive || supernovaAge < delay) {
          mesh.visible = false;
          material.opacity = 0;
          return;
        }
        const localProgress = Math.min(1, (supernovaAge - delay) / 1.7);
        mesh.visible = true;
        mesh.scale.setScalar(0.55 + localProgress * 4.8);
        material.opacity = (1 - localProgress) * 0.72 * (1 - delay * 0.8);
      });

      railShots.forEach((shot) => {
        if (!burstEnabled || !hasSignal || (!isPlaying && !shot.readyEnabled)) {
          shot.group.visible = false;
          return;
        }

        const rate = isPlaying ? shot.cycleRate * 2.75 : shot.cycleRate * 0.45;
        const duty = isPlaying ? shot.duty : 0.018;
        const cycle = (elapsed * rate + shot.cycleOffset) % 1;

        if (cycle >= duty || playingMotionOff || reduced) {
          shot.group.visible = false;
          return;
        }

        const progress = THREE.MathUtils.clamp(cycle / duty, 0, 1);
        const flare = Math.sin(progress * Math.PI);
        const intensity =
          flare *
          (isPlaying ? 1.2 + reactiveKick * 0.45 + reactiveGlobal * 0.2 : 0.2) *
          volumeScale;
        shot.group.visible = true;
        shot.coreMaterial.opacity = 0.95 * intensity;
        shot.glowMaterial.opacity = 0.24 * intensity;
        shot.helixMaterial.opacity = 0.78 * intensity;
      });

      lightningArcs.forEach((arc, index) => {
        const enabled =
          burstEnabled &&
          hasSignal &&
          (reactiveParticles > 0.1 || reactiveKick > 0.2);
        if (!enabled) {
          arc.material.opacity = 0;
          return;
        }

        const arcPulse = Math.max(
          0,
          Math.sin(
            elapsed * (1.9 + index * 0.3 + reactiveOrbit * 0.25) + arc.phase,
          ),
        );
        if (arcPulse < 0.65) {
          arc.material.opacity = 0;
          return;
        }

        const curve = new THREE.CatmullRomCurve3([
          arc.points[0].clone(),
          arc.points[1]
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * arc.jitter,
                (Math.random() - 0.5) * arc.jitter,
                0,
              ),
            ),
          arc.points[2]
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * arc.jitter,
                (Math.random() - 0.5) * arc.jitter,
                0,
              ),
            ),
          arc.points[3].clone(),
        ]);

        const positions = arc.line.geometry.attributes
          .position as THREE.BufferAttribute;
        const sampled = curve.getPoints(positions.count - 1);
        sampled.forEach((point, pointIndex) => {
          positions.setXYZ(pointIndex, point.x, point.y, point.z);
        });
        positions.needsUpdate = true;

        arc.material.opacity = Math.min(
          0.62,
          (arcPulse - 0.65) * 1.6 * (1 + reactiveParticles * 0.35),
        );
      });

      sweepBeams.forEach((beam) => {
        const wave = Math.max(0, Math.sin(elapsed * beam.speed + beam.phase));
        const flash = Math.pow(wave, isPlaying ? 6 : 12);
        const intensity = isPlaying
          ? flash *
            volumeScale *
            (1.15 + reactiveParticles * 0.42 + reactiveKick * 0.18)
          : 0;

        beam.group.position.y =
          beam.baseY +
          Math.sin(elapsed * beam.speed * 0.45 + beam.phase) *
            (playingMotionOff ? 0.05 : 0.25);
        beam.group.rotation.z =
          Math.sin(elapsed * beam.speed * 0.56 + beam.phase) *
          (playingMotionOff ? 0.02 : 0.08);
        beam.coreMaterial.opacity = 0.54 * intensity;
        beam.glowMaterial.opacity = 0.15 * intensity;
      });

      floatingGlyphs.forEach(({ mesh, basePosition, phase }, index) => {
        const detailAmplitude =
          0.52 + reactiveParticles * 0.95 + reactiveOrbit * 0.18;
        mesh.position.y =
          basePosition.y +
          Math.sin(elapsed * 0.32 + phase) * 0.14 * detailAmplitude;
        mesh.position.x =
          basePosition.x +
          Math.cos(elapsed * 0.18 + phase) * 0.08 * detailAmplitude;
        mesh.rotation.z +=
          (index % 2 === 0 ? 1 : -1) *
          0.055 *
          (0.6 + reactiveParticles * 0.8) *
          delta *
          kineticScale;
      });

      const starDriftScale =
        0.42 + reactiveParticles * 0.95 + reactiveGlobal * 0.16;
      distantStars.points.rotation.y +=
        0.0012 * delta * kineticScale * starDriftScale;
      accentStars.points.rotation.z -=
        0.0018 * delta * kineticScale * starDriftScale;
      brightStars.points.rotation.y -=
        0.0024 * delta * kineticScale * starDriftScale;
      distantStarsMaterial.uniforms.uOpacity.value =
        starBaseOpacity.distant * (1 + reactiveParticles * 0.1);
      accentStarsMaterial.uniforms.uOpacity.value =
        starBaseOpacity.accent * (1 + reactiveParticles * 0.16);
      brightStarsMaterial.uniforms.uOpacity.value =
        starBaseOpacity.bright * (1 + reactiveParticles * 0.22);
      if (supernovaEnvelope > 0) {
        accentStars.points.scale.setScalar(1 + supernovaEnvelope * 0.08);
        brightStars.points.scale.setScalar(1 + supernovaEnvelope * 0.14);
        accentStarsMaterial.uniforms.uOpacity.value += supernovaEnvelope * 0.18;
        brightStarsMaterial.uniforms.uOpacity.value += supernovaEnvelope * 0.3;
      } else {
        accentStars.points.scale.setScalar(1);
        brightStars.points.scale.setScalar(1);
      }

      [distantStarsMaterial, accentStarsMaterial, brightStarsMaterial].forEach(
        (material) => {
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uHueShift.value = chromaReactiveActive
            ? sharedHueOffsetDegrees / 360
            : 0;
          material.uniforms.uTwinkle.value = chromaReactiveActive ? 1 : 0.82;
          material.uniforms.uSurge.value = supernovaEnvelope;
          material.uniforms.uSizeScale.value = 1 + supernovaEnvelope * 0.16;
        },
      );

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      applyResponsiveLayout();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      timer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={mountRef} className="cosmic-nexus-scene" aria-hidden="true" />
  );
}

export default CosmicNexusTheme;
