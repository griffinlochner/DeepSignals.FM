import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThemeSceneProps } from '../themeTypes'
import {
  SIGNAL_NEXUS_REACTIVITY,
  createNeutralSignalNexusReactiveState,
  resolveSignalNexusReactiveTarget,
  stepSignalNexusReactiveState,
} from './signalNexusReactivity'
import './cosmicNexus.css'

type NexusShell = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  spin: THREE.Vector3
  wobble: number
  baseRotation: THREE.Euler
}

type NexusRing = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  spin: number
  pulsePhase: number
  baseRotation: THREE.Euler
}

type Satellite = {
  group: THREE.Group
  shell: THREE.Mesh
  shellMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  orbitRadius: number
  orbitSpeed: number
  orbitPhase: number
  yDrift: number
  basePosition: THREE.Vector3
  baseShellRotation: THREE.Euler
}

type InboundLane = {
  curve: THREE.Curve<THREE.Vector3>
  innerMaterial: THREE.MeshBasicMaterial
  outerMaterial: THREE.MeshBasicMaterial
  baseInnerOpacity: number
  baseOuterOpacity: number
  travelRate: number
  pulseBoost: number
}

type TravelingPulse = {
  core: THREE.Mesh
  glow: THREE.Mesh
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  lane: InboundLane
  offset: number
  baseProgress: number
}

type RailShot = {
  group: THREE.Group
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  helixMaterial: THREE.MeshBasicMaterial
  cycleRate: number
  cycleOffset: number
  duty: number
  readyEnabled: boolean
}

type LightningArc = {
  line: THREE.Line
  material: THREE.LineBasicMaterial
  points: THREE.Vector3[]
  jitter: number
  phase: number
}

type ActivationWave = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  delay: number
}

type SweepBeam = {
  group: THREE.Group
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  baseY: number
  phase: number
  speed: number
  baseRotationZ: number
}

type FloatingGlyph = {
  mesh: THREE.LineLoop
  basePosition: THREE.Vector3
  phase: number
  baseRotationZ: number
}

const COSMIC_NEXUS_NEUTRAL_HUE_OFFSET_DEGREES = 0
const COSMIC_NEXUS_NEUTRAL_SATURATION_MULTIPLIER = 1
const COSMIC_NEXUS_NEUTRAL_EMISSIVE_MULTIPLIER = 1

const COLORS = {
  cyan: 0x79fff2,
  green: 0x39ff14,
  pink: 0xff4d7a,
  orange: 0xff7a00,
  violet: 0xa45cff,
  white: 0xe9fffb,
}

function inQuietZone(x: number, y: number) {
  const upperLeftConsoleZone = x < -2.2 && y > 1.4
  const lowerRightFeedZone = x > 3.6 && y < -1.1
  return upperLeftConsoleZone || lowerRightFeedZone
}

function CosmicNexusTheme(props: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const visualStateRef = useRef(props)

  useEffect(() => {
    visualStateRef.current = props
  }, [props])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x010104)
    scene.fog = new THREE.FogExp2(0x010104, 0.024)

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 140)
    camera.position.set(0, 0, 11)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.willChange = 'filter'
    mount.appendChild(renderer.domElement)

    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()

    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.add(geometry)
      return geometry
    }

    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.add(material)
      return material
    }

    const world = new THREE.Group()
    scene.add(world)

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
    ) => {
      const positions = new Float32Array(count * 3)

      for (let i = 0; i < count; i += 1) {
        let x: number
        let y: number
        let attempts = 0

        do {
          x = (Math.random() - 0.5) * spreadX
          y = (Math.random() - 0.5) * spreadY
          attempts += 1
        } while (respectQuietZones && attempts < 8 && inQuietZone(x, y))

        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ)
      }

      const geometry = trackGeometry(new THREE.BufferGeometry())
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

      const material = trackMaterial(
        new THREE.PointsMaterial({
          color,
          size,
          sizeAttenuation: true,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const points = new THREE.Points(geometry, material)
      world.add(points)
      return points
    }

    const distantStars = createStarLayer(1650, 74, 42, 0.02, 0xffffff, 0.56, -42, -9, false)
    const accentStars = createStarLayer(340, 66, 32, 0.045, COLORS.violet, 0.36, -28, -2, true)
    const brightStars = createStarLayer(110, 60, 28, 0.075, COLORS.cyan, 0.56, -18, 0, true)
    const distantStarsMaterial = distantStars.material as THREE.PointsMaterial
    const accentStarsMaterial = accentStars.material as THREE.PointsMaterial
    const brightStarsMaterial = brightStars.material as THREE.PointsMaterial
    const starBaseOpacity = {
      distant: distantStarsMaterial.opacity,
      accent: accentStarsMaterial.opacity,
      bright: brightStarsMaterial.opacity,
    }

    const nexusCenter = new THREE.Vector3(0.35, 0.05, -0.15)
    const nexusGroup = new THREE.Group()
    nexusGroup.position.copy(nexusCenter)
    world.add(nexusGroup)

    const nexusShells: NexusShell[] = []
    const nexusRings: NexusRing[] = []
    const satellites: Satellite[] = []
    const inboundLanes: InboundLane[] = []
    const travelingPulses: TravelingPulse[] = []
    const railShots: RailShot[] = []
    const lightningArcs: LightningArc[] = []
    const activationWaves: ActivationWave[] = []
    const sweepBeams: SweepBeam[] = []
    const floatingGlyphs: FloatingGlyph[] = []

    const coreGlowMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const coreGlow = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(1.9, 36, 28)), coreGlowMaterial)
    nexusGroup.add(coreGlow)

    const coreSolidMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x05060f,
        transparent: true,
        opacity: 0.95,
      }),
    )
    const coreSolid = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.86, 2)), coreSolidMaterial)
    nexusGroup.add(coreSolid)

    const shellSpecs = [
      {
        geometry: trackGeometry(new THREE.IcosahedronGeometry(1.16, 2)),
        color: COLORS.cyan,
        opacity: 0.58,
        spin: new THREE.Vector3(0.1, 0.15, 0.04),
        wobble: 0.05,
      },
      {
        geometry: trackGeometry(new THREE.OctahedronGeometry(1.36, 2)),
        color: COLORS.green,
        opacity: 0.46,
        spin: new THREE.Vector3(-0.08, 0.12, -0.05),
        wobble: 0.07,
      },
      {
        geometry: trackGeometry(new THREE.IcosahedronGeometry(1.56, 1)),
        color: COLORS.violet,
        opacity: 0.34,
        spin: new THREE.Vector3(0.06, -0.09, 0.08),
        wobble: 0.04,
      },
    ]

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
      )
      const mesh = new THREE.Mesh(spec.geometry, material)
      nexusGroup.add(mesh)
      nexusShells.push({
        mesh,
        material,
        spin: spec.spin,
        wobble: spec.wobble,
        baseRotation: mesh.rotation.clone(),
      })
    })

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
    ]

    ringSpecs.forEach((spec, index) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.44 - index * 0.06,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const mesh = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(spec.radius, spec.tube, 12, 140)), material)
      mesh.rotation.copy(spec.tilt)
      nexusGroup.add(mesh)
      nexusRings.push({
        mesh,
        material,
        spin: spec.spin,
        pulsePhase: Math.random() * Math.PI * 2,
        baseRotation: mesh.rotation.clone(),
      })
    })

    const satellitePositions = [
      { radius: 3.3, speed: 0.26, phase: 0.2, drift: 0.45, color: COLORS.orange },
      { radius: 3.8, speed: -0.19, phase: 2.4, drift: -0.38, color: COLORS.pink },
      { radius: 4.15, speed: 0.14, phase: 4.6, drift: 0.32, color: COLORS.cyan },
    ]

    satellitePositions.forEach(({ radius, speed, phase, drift, color }) => {
      const group = new THREE.Group()
      world.add(group)

      const shellMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const shell = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.3, 1)), shellMaterial)
      const glow = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(0.56, 20, 14)), glowMaterial)
      group.add(shell, glow)

      const basePosition = new THREE.Vector3(
        nexusCenter.x + Math.cos(phase) * radius,
        nexusCenter.y + Math.sin(phase * 0.82) * drift,
        -0.9 + Math.sin(phase * 0.6) * 0.7,
      )
      group.position.copy(basePosition)

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
      })
    })

    const createInboundCurve = (edge: THREE.Vector3, controlA: THREE.Vector3, controlB: THREE.Vector3, port: THREE.Vector3) =>
      new THREE.CatmullRomCurve3([edge, controlA, controlB, port], false, 'catmullrom', 0.42)

    const pulseCoreGeometry = trackGeometry(new THREE.SphereGeometry(0.052, 10, 8))
    const pulseGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.14, 12, 10))

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
      )
      const innerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const outerMesh = new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(curve, 160, radius * 2.4, 7, false)), outerMaterial)
      const innerMesh = new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(curve, 160, radius, 6, false)), innerMaterial)
      world.add(outerMesh, innerMesh)

      const lane: InboundLane = {
        curve,
        innerMaterial,
        outerMaterial,
        baseInnerOpacity: innerMaterial.opacity,
        baseOuterOpacity: outerMaterial.opacity,
        travelRate,
        pulseBoost,
      }
      inboundLanes.push(lane)

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      ;[pulseOffset, pulseOffset + 0.46].forEach((offset) => {
        const core = new THREE.Mesh(pulseCoreGeometry, coreMaterial)
        const glow = new THREE.Mesh(pulseGlowGeometry, glowMaterial)
        world.add(core, glow)
        travelingPulses.push({
          core,
          glow,
          coreMaterial,
          glowMaterial,
          lane,
          offset,
          baseProgress: ((offset % 1) + 1) % 1,
        })
      })
    }

    const edgeSpecs = [
      {
        edge: new THREE.Vector3(-11.8, 3.6, -4.8),
        controlA: new THREE.Vector3(-8.6, 3.3, -2.2),
        controlB: new THREE.Vector3(-4.2, 2.5, -0.7),
        port: new THREE.Vector3(-1.45, 1.1, -0.08).add(nexusCenter),
        color: COLORS.cyan,
        radius: 0.012,
        speed: 0.18,
        offset: 0.06,
        pulseBoost: 1,
      },
      {
        edge: new THREE.Vector3(-12.4, 0.5, -4.2),
        controlA: new THREE.Vector3(-8.7, 0.75, -2.3),
        controlB: new THREE.Vector3(-4.6, 0.8, -0.75),
        port: new THREE.Vector3(-1.55, 0.12, -0.05).add(nexusCenter),
        color: COLORS.green,
        radius: 0.011,
        speed: 0.22,
        offset: 0.22,
        pulseBoost: 0.92,
      },
      {
        edge: new THREE.Vector3(-11.9, -3.4, -4.8),
        controlA: new THREE.Vector3(-8.3, -2.8, -2.1),
        controlB: new THREE.Vector3(-4.0, -1.85, -0.65),
        port: new THREE.Vector3(-1.35, -1.05, -0.05).add(nexusCenter),
        color: COLORS.pink,
        radius: 0.012,
        speed: 0.2,
        offset: 0.34,
        pulseBoost: 1,
      },
      {
        edge: new THREE.Vector3(-5.8, 8.9, -4.1),
        controlA: new THREE.Vector3(-4.8, 5.8, -2.2),
        controlB: new THREE.Vector3(-3.0, 3.4, -0.8),
        port: new THREE.Vector3(-0.55, 1.62, -0.02).add(nexusCenter),
        color: COLORS.orange,
        radius: 0.01,
        speed: 0.16,
        offset: 0.47,
        pulseBoost: 0.82,
      },
      {
        edge: new THREE.Vector3(0.5, 9.2, -4.2),
        controlA: new THREE.Vector3(0.4, 6.2, -2.3),
        controlB: new THREE.Vector3(0.25, 3.7, -0.86),
        port: new THREE.Vector3(0.1, 1.82, -0.02).add(nexusCenter),
        color: COLORS.violet,
        radius: 0.01,
        speed: 0.17,
        offset: 0.58,
        pulseBoost: 0.8,
      },
      {
        edge: new THREE.Vector3(7.8, 7.8, -4.5),
        controlA: new THREE.Vector3(6.5, 5.2, -2.4),
        controlB: new THREE.Vector3(4.0, 3.0, -0.9),
        port: new THREE.Vector3(1.15, 1.22, -0.02).add(nexusCenter),
        color: COLORS.orange,
        radius: 0.01,
        speed: 0.16,
        offset: 0.7,
        pulseBoost: 0.84,
      },
      {
        edge: new THREE.Vector3(8.3, -5.0, -4.5),
        controlA: new THREE.Vector3(6.7, -3.6, -2.4),
        controlB: new THREE.Vector3(4.1, -2.1, -0.9),
        port: new THREE.Vector3(1.2, -1.15, -0.02).add(nexusCenter),
        color: COLORS.violet,
        radius: 0.01,
        speed: 0.15,
        offset: 0.83,
        pulseBoost: 0.86,
      },
      {
        edge: new THREE.Vector3(0.6, -9.2, -4.0),
        controlA: new THREE.Vector3(0.42, -6.15, -2.2),
        controlB: new THREE.Vector3(0.25, -3.6, -0.8),
        port: new THREE.Vector3(0.05, -1.9, -0.02).add(nexusCenter),
        color: COLORS.pink,
        radius: 0.01,
        speed: 0.17,
        offset: 0.94,
        pulseBoost: 0.8,
      },
    ]

    edgeSpecs.forEach((spec) => {
      createInboundLane(
        createInboundCurve(spec.edge, spec.controlA, spec.controlB, spec.port),
        spec.color,
        spec.radius,
        spec.speed,
        spec.offset,
        spec.pulseBoost,
      )
    })

    const activationWaveGeometry = trackGeometry(new THREE.TorusGeometry(3.2, 0.03, 8, 180))
    ;[
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
      )
      const mesh = new THREE.Mesh(activationWaveGeometry, material)
      mesh.position.copy(nexusCenter)
      mesh.scale.set(1, 0.62, 1)
      mesh.visible = false
      world.add(mesh)
      activationWaves.push({ mesh, material, delay })
    })

    const buildHelixCurve = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      turns: number,
      radius: number,
      pointsCount: number,
    ) => {
      const forward = end.clone().sub(start).normalize()
      const axisRef = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      const side = new THREE.Vector3().crossVectors(forward, axisRef).normalize()
      const up = new THREE.Vector3().crossVectors(side, forward).normalize()
      const points: THREE.Vector3[] = []

      for (let i = 0; i <= pointsCount; i += 1) {
        const t = i / pointsCount
        const point = start.clone().lerp(end, t)
        const phase = t * Math.PI * 2 * turns
        const tapered = THREE.MathUtils.lerp(radius, radius * 0.25, t)
        point.addScaledVector(side, Math.cos(phase) * tapered)
        point.addScaledVector(up, Math.sin(phase) * tapered)
        points.push(point)
      }

      return new THREE.CatmullRomCurve3(points)
    }

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
    ]

    railSpecs.forEach((spec, index) => {
      const group = new THREE.Group()
      group.visible = false
      world.add(group)

      const straightCurve = new THREE.LineCurve3(spec.start, spec.end)
      const helixCurve = buildHelixCurve(spec.start, spec.end, spec.turns, spec.radius, 180)

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.white,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.glow,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const helixMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.accent,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      group.add(
        new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(straightCurve, 16, 0.05, 7, false)), glowMaterial),
        new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(straightCurve, 16, 0.013, 6, false)), coreMaterial),
        new THREE.Mesh(trackGeometry(new THREE.TubeGeometry(helixCurve, 180, 0.015, 6, false)), helixMaterial),
      )

      railShots.push({
        group,
        coreMaterial,
        glowMaterial,
        helixMaterial,
        cycleRate: 0.16 + (index % 3) * 0.02,
        cycleOffset: index * 0.21,
        duty: 0.08,
        readyEnabled: index === 0,
      })
    })

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
    ]

    arcPairs.forEach((spec, index) => {
      const points = [
        spec.start,
        spec.start.clone().lerp(spec.end, 0.35).add(new THREE.Vector3(0.2, 0.9, 0)),
        spec.start.clone().lerp(spec.end, 0.66).add(new THREE.Vector3(-0.22, -0.45, 0.15)),
        spec.end,
      ]
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.8)
      const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)))
      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const line = new THREE.Line(geometry, material)
      world.add(line)
      lightningArcs.push({ line, material, points, jitter: 0.24 + index * 0.07, phase: Math.random() * Math.PI * 2 })
    })

    const sweepGeometryCore = trackGeometry(new THREE.CylinderGeometry(0.008, 0.008, 14.5, 6, 1, true))
    const sweepGeometryGlow = trackGeometry(new THREE.CylinderGeometry(0.036, 0.036, 14.5, 6, 1, true))
    ;[
      { y: 3.2, phase: 0.4, speed: 0.64, color: COLORS.cyan },
      { y: -3.25, phase: 2.5, speed: 0.49, color: COLORS.pink },
    ].forEach(({ y, phase, speed, color }) => {
      const group = new THREE.Group()
      group.position.set(nexusCenter.x, y, -4.7)
      world.add(group)

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.white,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const glow = new THREE.Mesh(sweepGeometryGlow, glowMaterial)
      const core = new THREE.Mesh(sweepGeometryCore, coreMaterial)
      glow.rotation.z = Math.PI / 2
      core.rotation.z = Math.PI / 2
      group.add(glow, core)

      sweepBeams.push({
        group,
        coreMaterial,
        glowMaterial,
        baseY: y,
        phase,
        speed,
        baseRotationZ: group.rotation.z,
      })
    })

    const glyphGeometry = trackGeometry(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.14, -0.14, 0),
        new THREE.Vector3(0.14, -0.14, 0),
        new THREE.Vector3(0.14, 0.14, 0),
        new THREE.Vector3(-0.14, 0.14, 0),
      ]),
    )

    const glyphColors = [COLORS.cyan, COLORS.orange, COLORS.pink, COLORS.violet]
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -1 : 1
      const x = side * (5.2 + Math.random() * 2.1)
      const y = (Math.random() - 0.5) * 5.4

      if (inQuietZone(x, y)) {
        continue
      }

      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color: glyphColors[i % glyphColors.length],
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const mesh = new THREE.LineLoop(glyphGeometry, material)
      const basePosition = new THREE.Vector3(x, y, -2.2 - Math.random() * 2.2)
      mesh.position.copy(basePosition)
      mesh.scale.setScalar(0.25 + Math.random() * 0.55)
      mesh.rotation.z = Math.random() * Math.PI
      world.add(mesh)
      floatingGlyphs.push({
        mesh,
        basePosition,
        phase: Math.random() * Math.PI * 2,
        baseRotationZ: mesh.rotation.z,
      })
    }

    const pointerTarget = new THREE.Vector2()
    const pointerCurrent = new THREE.Vector2()
    const pointerRest = new THREE.Vector2(0, 0)
    const settleUnitScale = new THREE.Vector3(1, 1, 1)
    const settlePulseCoreScale = new THREE.Vector3(0.92, 0.92, 0.92)
    const settlePulseGlowScale = new THREE.Vector3(1.22, 1.22, 1.22)
    const settleActivationScale = new THREE.Vector3(1, 0.62, 1)

    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', handlePointerMove)

    const applyResponsiveLayout = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      const aspect = width / Math.max(height, 1)

      if (width < 640) {
        world.scale.setScalar(0.66)
        world.position.set(0.16, -0.14, 0)
        camera.fov = 68
      } else if (width < 1000 || aspect < 1.28) {
        world.scale.setScalar(0.82)
        world.position.set(0.13, 0.0, 0)
        camera.fov = 63
      } else {
        world.scale.setScalar(1)
        world.position.set(0.1, 0.12, 0)
        camera.fov = 58
      }

      camera.updateProjectionMatrix()
    }

    applyResponsiveLayout()

    const timer = new THREE.Timer()
    timer.connect(document)

    let elapsed = 0
    let grayscaleMix = visualStateRef.current.isPlaying ? 0 : 1
    let frameId = 0
    let previousHasSignal = Boolean(visualStateRef.current.signalId)
    let previousPlaying = visualStateRef.current.isPlaying
    let previousReactiveSignalId = visualStateRef.current.signalId
    let previousKickAcceptedCount = 0
    let previousKickAcceptedSequence = 0
    let reactiveState = createNeutralSignalNexusReactiveState()
    let activationProgress = 1
    let activationStrength = 0

    const animate = () => {
      frameId = window.requestAnimationFrame(animate)
      timer.update()

      const state = visualStateRef.current
      const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const reduced = state.reducedMotion || systemReducedMotion
      const isPlaying = state.isPlaying === true
      const chromaEnabled = state.chromaEnabled !== false
      const hasSignal = Boolean(state.signalId)
      const motionEnabled = state.motionEnabled ?? true
      const motionActive = isPlaying && motionEnabled
      const playingMotionOff = isPlaying && !motionEnabled
      const latestSnapshot = typeof state.getLatestAudioSnapshot === 'function' ? state.getLatestAudioSnapshot() : null
      const activeSnapshot = latestSnapshot?.isActive === true ? latestSnapshot : null
      const volumeScale = 0.67 + state.volume * 0.33
      const grayscaleTarget = isPlaying ? 0 : 1
      const grayscaleLerp = reduced ? 1 : 0.08

      grayscaleMix += (grayscaleTarget - grayscaleMix) * grayscaleLerp
      if (Math.abs(grayscaleTarget - grayscaleMix) <= 0.001) {
        grayscaleMix = grayscaleTarget
      }

      if (state.signalId !== previousReactiveSignalId) {
        previousReactiveSignalId = state.signalId
        previousKickAcceptedCount = activeSnapshot?.kickPulseAcceptedEventCount ?? 0
        previousKickAcceptedSequence = activeSnapshot?.kickPulseAcceptedEventSequence ?? 0
        reactiveState = createNeutralSignalNexusReactiveState()
      }

      const playbackJustStarted = isPlaying && !previousPlaying
      if (playbackJustStarted) {
        previousKickAcceptedCount = activeSnapshot?.kickPulseAcceptedEventCount ?? previousKickAcceptedCount
        previousKickAcceptedSequence = activeSnapshot?.kickPulseAcceptedEventSequence ?? previousKickAcceptedSequence
      }

      const nextKickAcceptedCount = activeSnapshot?.kickPulseAcceptedEventCount ?? previousKickAcceptedCount
      const nextKickAcceptedSequence = activeSnapshot?.kickPulseAcceptedEventSequence ?? previousKickAcceptedSequence
      const kickEdge =
        (!playbackJustStarted && (activeSnapshot?.kickPulseAcceptedEvent ?? false)) ||
        nextKickAcceptedCount > previousKickAcceptedCount ||
        nextKickAcceptedSequence > previousKickAcceptedSequence
      previousKickAcceptedCount = nextKickAcceptedCount
      previousKickAcceptedSequence = nextKickAcceptedSequence

      const delta = Math.min(timer.getDelta(), 0.05)
      const reactiveTarget = resolveSignalNexusReactiveTarget({
        isPlaying,
        chromaEnabled,
        snapshot: activeSnapshot,
        kickImpulseSeed: kickEdge ? 1 : activeSnapshot?.kickPulse ?? 0,
      })
      reactiveState = stepSignalNexusReactiveState(reactiveState, reactiveTarget, delta)

      const chromaReactiveActive = isPlaying && chromaEnabled
      const hueOffset = chromaReactiveActive ? reactiveState.hueOffset : COSMIC_NEXUS_NEUTRAL_HUE_OFFSET_DEGREES
      const saturation = chromaReactiveActive ? reactiveState.saturation : COSMIC_NEXUS_NEUTRAL_SATURATION_MULTIPLIER
      const emissive = chromaReactiveActive ? reactiveState.emissiveIntensity : COSMIC_NEXUS_NEUTRAL_EMISSIVE_MULTIPLIER

      renderer.domElement.style.filter = [
        `grayscale(${grayscaleMix.toFixed(3)})`,
        `hue-rotate(${hueOffset.toFixed(3)}deg)`,
        `saturate(${saturation.toFixed(3)})`,
        `brightness(${emissive.toFixed(3)})`,
      ].join(' ')

      const kineticScale = reduced ? 0.12 : playingMotionOff ? 0.16 : 1
      const trafficScale = reduced ? 0.05 : playingMotionOff ? 0.16 : 1
      const burstEnabled = isPlaying && motionEnabled && !reduced
      const dampedActiveScale = playingMotionOff ? 0.42 : 1.2
      const reactiveGlobal = reactiveState.globalIntensity
      const reactiveCore = reactiveState.corePulse
      const reactiveKick = reactiveState.kickImpulse
      const reactiveOrbit = reactiveState.orbitIntensity
      const reactiveParticles = reactiveState.particleIntensity
      const motionTuning = SIGNAL_NEXUS_REACTIVITY.motion

      if (motionActive) {
        elapsed += delta * kineticScale
      }

      const settleAlpha = THREE.MathUtils.clamp(delta * (reduced ? 8 : 5.5), 0, 1)

      if (!motionActive) {
        const stablePlayingOpacityScale = isPlaying ? 1 : 0.55

        previousHasSignal = hasSignal
        previousPlaying = isPlaying
        activationProgress = 1
        activationStrength = 0

        pointerCurrent.lerp(pointerRest, settleAlpha)
        world.rotation.y = THREE.MathUtils.lerp(world.rotation.y, 0, settleAlpha)
        world.rotation.x = THREE.MathUtils.lerp(world.rotation.x, 0, settleAlpha)

        coreGlow.scale.lerp(settleUnitScale, settleAlpha)
        coreGlowMaterial.opacity = (isPlaying ? 0.2 + reactiveGlobal * 0.06 : 0.08) * volumeScale

        nexusShells.forEach(({ mesh, material, baseRotation }, index) => {
          mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, baseRotation.x, settleAlpha)
          mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, baseRotation.y, settleAlpha)
          mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, baseRotation.z, settleAlpha)
          mesh.scale.lerp(settleUnitScale, settleAlpha)
          material.opacity = THREE.MathUtils.clamp((0.52 - index * 0.05) * stablePlayingOpacityScale, 0.08, 0.82)
        })

        nexusRings.forEach(({ mesh, material, baseRotation }, index) => {
          mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, baseRotation.x, settleAlpha)
          mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, baseRotation.y, settleAlpha)
          mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, baseRotation.z, settleAlpha)
          material.opacity = (0.34 - index * 0.05) * stablePlayingOpacityScale
        })

        satellites.forEach((satellite) => {
          satellite.group.position.lerp(satellite.basePosition, settleAlpha)
          satellite.shell.rotation.x = THREE.MathUtils.lerp(
            satellite.shell.rotation.x,
            satellite.baseShellRotation.x,
            settleAlpha,
          )
          satellite.shell.rotation.y = THREE.MathUtils.lerp(
            satellite.shell.rotation.y,
            satellite.baseShellRotation.y,
            settleAlpha,
          )
          satellite.shellMaterial.opacity = (isPlaying ? 0.54 : 0.2) * stablePlayingOpacityScale
          satellite.glowMaterial.opacity = (isPlaying ? 0.1 + reactiveGlobal * 0.04 : 0.03) * volumeScale
        })

        const lanePower = (isPlaying ? 1.35 : 0.16) * stablePlayingOpacityScale
        inboundLanes.forEach((lane) => {
          lane.outerMaterial.opacity = Math.min(1, lane.baseOuterOpacity * lanePower * volumeScale)
          lane.innerMaterial.opacity = Math.min(1, lane.baseInnerOpacity * lanePower * volumeScale)
        })

        travelingPulses.forEach(({ core, glow, coreMaterial, glowMaterial, lane, baseProgress }) => {
          const point = lane.curve.getPointAt(baseProgress)
          core.position.copy(point)
          glow.position.copy(point)
          core.scale.lerp(settlePulseCoreScale, settleAlpha)
          glow.scale.lerp(settlePulseGlowScale, settleAlpha)
          coreMaterial.opacity = THREE.MathUtils.clamp(isPlaying ? lane.pulseBoost : 0.2, 0.15, 1)
          glowMaterial.opacity = (isPlaying ? 0.13 + reactiveGlobal * 0.06 : 0.03) * volumeScale
        })

        activationWaves.forEach(({ mesh, material }) => {
          mesh.visible = false
          material.opacity = 0
          mesh.scale.lerp(settleActivationScale, settleAlpha)
        })

        railShots.forEach((shot) => {
          shot.group.visible = false
          shot.coreMaterial.opacity = 0
          shot.glowMaterial.opacity = 0
          shot.helixMaterial.opacity = 0
        })

        lightningArcs.forEach((arc) => {
          arc.material.opacity = 0
        })

        sweepBeams.forEach((beam) => {
          beam.group.position.y = THREE.MathUtils.lerp(beam.group.position.y, beam.baseY, settleAlpha)
          beam.group.rotation.z = THREE.MathUtils.lerp(beam.group.rotation.z, beam.baseRotationZ, settleAlpha)
          beam.coreMaterial.opacity = 0
          beam.glowMaterial.opacity = 0
        })

        floatingGlyphs.forEach(({ mesh, basePosition, baseRotationZ }) => {
          mesh.position.lerp(basePosition, settleAlpha)
          mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, baseRotationZ, settleAlpha)
        })

        distantStars.rotation.y = THREE.MathUtils.lerp(distantStars.rotation.y, 0, settleAlpha)
        accentStars.rotation.z = THREE.MathUtils.lerp(accentStars.rotation.z, 0, settleAlpha)
        brightStars.rotation.y = THREE.MathUtils.lerp(brightStars.rotation.y, 0, settleAlpha)
        distantStarsMaterial.opacity = starBaseOpacity.distant * (isPlaying ? 1 + reactiveParticles * 0.08 : 1)
        accentStarsMaterial.opacity = starBaseOpacity.accent * (isPlaying ? 1 + reactiveParticles * 0.14 : 1)
        brightStarsMaterial.opacity = starBaseOpacity.bright * (isPlaying ? 1 + reactiveParticles * 0.2 : 1)

        renderer.render(scene, camera)
        return
      }

      if (hasSignal && !previousHasSignal) {
        activationProgress = 0
        activationStrength = 0.86
      } else if (isPlaying && !previousPlaying) {
        activationProgress = 0
        activationStrength = 1.4
      } else if (!isPlaying && previousPlaying) {
        activationProgress = 0
        activationStrength = 0.6
      } else if (!hasSignal && previousHasSignal) {
        activationProgress = 0
        activationStrength = 0.34
      }

      previousHasSignal = hasSignal
      previousPlaying = isPlaying

      if (reduced) {
        activationProgress = 1
      } else {
        activationProgress = Math.min(1, activationProgress + delta * (isPlaying ? 1.48 : 1.1))
      }

      const transitionBoost = Math.max(0, 1 - activationProgress) * activationStrength

      pointerCurrent.lerp(pointerTarget, reduced ? 0.01 : playingMotionOff ? 0.005 : 0.024)
      world.rotation.y = pointerCurrent.x * 0.02
      world.rotation.x = -pointerCurrent.y * 0.015

      const corePulse = (Math.sin(elapsed * (isPlaying ? 2.8 : 1.1)) + 1) * 0.5
      const coreReactiveScale =
        reactiveCore * motionTuning.coreBreathReactiveAmplitude +
        reactiveKick * motionTuning.coreKickImpulseAmplitude
      coreGlow.scale.setScalar(
        1 +
          corePulse *
            (isPlaying
              ? motionTuning.coreBreathBaseAmplitude + coreReactiveScale
              : 0.07),
      )
      coreGlowMaterial.opacity = (isPlaying ? 0.36 + reactiveGlobal * 0.08 + reactiveKick * 0.05 : 0.07) * volumeScale

      nexusShells.forEach(({ mesh, material, spin, wobble }, index) => {
        const spinFactor =
          (reduced ? 0.18 : playingMotionOff ? 0.2 : 1) *
          (1 + reactiveOrbit * motionTuning.shellSpinReactiveInfluence)
        mesh.rotation.x += spin.x * delta * spinFactor * (0.62 + dampedActiveScale)
        mesh.rotation.y += spin.y * delta * spinFactor * (0.62 + dampedActiveScale)
        mesh.rotation.z += spin.z * delta * spinFactor * (0.62 + dampedActiveScale)
        const wobblePulse =
          1 +
          Math.sin(elapsed * (1.2 + index * 0.15) + index) *
            wobble *
            (1 + reactiveCore * 0.18)
        mesh.scale.setScalar(wobblePulse)
        material.opacity = THREE.MathUtils.clamp(
          (isPlaying ? 0.58 + reactiveGlobal * 0.08 : 0.22) + transitionBoost * 0.14 - index * 0.05,
          0.08,
          0.86,
        )
      })

      nexusRings.forEach(({ mesh, material, spin, pulsePhase }, index) => {
        const orbitRate = 1 + reactiveOrbit * motionTuning.ringSpinReactiveInfluence
        mesh.rotation.y += spin * delta * kineticScale * (0.7 + dampedActiveScale) * orbitRate
        mesh.rotation.x += spin * delta * kineticScale * 0.28 * orbitRate
        const ringPulse = (Math.sin(elapsed * (1.5 + index * 0.25) + pulsePhase) + 1) * 0.5
        material.opacity =
          (isPlaying ? 0.38 + reactiveGlobal * 0.08 : 0.12) +
          ringPulse * (isPlaying ? 0.2 + reactiveKick * 0.04 : 0.08)
      })

      satellites.forEach((satellite, index) => {
        const orbitRate =
          motionTuning.satelliteOrbitBaseScale *
          (1 +
            reactiveOrbit * motionTuning.satelliteOrbitReactiveInfluence +
            reactiveGlobal * motionTuning.satelliteOrbitGlobalInfluence)
        const orbitAngle =
          elapsed * satellite.orbitSpeed * (isPlaying ? orbitRate : 0.4) +
          satellite.orbitPhase
        const x = nexusCenter.x + Math.cos(orbitAngle) * satellite.orbitRadius
        const y = nexusCenter.y + Math.sin(orbitAngle * 0.82) * satellite.yDrift
        const z = -0.9 + Math.sin(orbitAngle * 0.6) * 0.7

        satellite.group.position.set(x, y, z)
        const shellSpinRate =
          motionTuning.satelliteShellSpinBaseScale *
          (1 + reactiveOrbit * motionTuning.satelliteShellSpinReactiveInfluence)
        satellite.shell.rotation.x += 0.4 * delta * kineticScale * shellSpinRate
        satellite.shell.rotation.y += 0.68 * delta * kineticScale * shellSpinRate

        const pulse = (Math.sin(elapsed * (1.4 + index * 0.2) + satellite.orbitPhase) + 1) * 0.5
        satellite.shellMaterial.opacity = (isPlaying ? 0.56 + reactiveGlobal * 0.08 : 0.2) + pulse * 0.1
        satellite.glowMaterial.opacity = (isPlaying ? 0.12 + reactiveParticles * 0.08 : 0.03) * volumeScale
      })

      const lanePower = (isPlaying ? 1.5 + reactiveGlobal * 0.7 + reactiveParticles * 0.25 : 0.14) + transitionBoost * 0.3
      inboundLanes.forEach((lane) => {
        lane.outerMaterial.opacity = Math.min(1, lane.baseOuterOpacity * lanePower * volumeScale)
        lane.innerMaterial.opacity = Math.min(1, lane.baseInnerOpacity * lanePower * volumeScale)
      })

      travelingPulses.forEach(({ core, glow, coreMaterial, glowMaterial, lane, offset }, index) => {
        const speed =
          lane.travelRate *
          (isPlaying ? motionTuning.travelerBaseRateScale : 0.15) *
          trafficScale *
          (1 +
            reactiveOrbit * motionTuning.travelerOrbitInfluence +
            reactiveGlobal * motionTuning.travelerGlobalInfluence)
        const progress = (elapsed * speed + offset) % 1
        const point = lane.curve.getPointAt(progress)
        core.position.copy(point)
        glow.position.copy(point)

        const flicker = (Math.sin(elapsed * (3 + index * 0.3) + offset) + 1) * 0.5
        const scale =
          0.86 +
          flicker *
            (motionTuning.travelerPulseBaseScale +
              reactiveKick * motionTuning.travelerPulseKickScale)
        core.scale.setScalar(scale)
        glow.scale.setScalar(
          scale *
            (isPlaying
              ? motionTuning.travelerGlowBaseScale +
                reactiveParticles * motionTuning.travelerGlowParticleScale
              : 0.7),
        )

        const boost = isPlaying ? lane.pulseBoost + reactiveGlobal * 0.16 : 0.25
        coreMaterial.opacity = THREE.MathUtils.clamp(boost, 0.15, 1)
        glowMaterial.opacity = (isPlaying ? 0.3 + reactiveParticles * 0.1 : 0.03) * volumeScale
      })

      activationWaves.forEach(({ mesh, material, delay }) => {
        const local = THREE.MathUtils.clamp((activationProgress - delay) / Math.max(0.001, 1 - delay), 0, 1)
        const active = activationProgress < 1 && local > 0 && local < 1
        mesh.visible = active

        if (!active) {
          material.opacity = 0
          return
        }

        const flare = Math.sin(local * Math.PI)
        mesh.scale.set(0.65 + local * 1.65, 0.65 + local * 1.03, 0.65 + local * 1.65)
        material.opacity = flare * activationStrength * (0.38 + reactiveKick * 0.18) * volumeScale
      })

      railShots.forEach((shot) => {
        if (!burstEnabled || !hasSignal || (!isPlaying && !shot.readyEnabled)) {
          shot.group.visible = false
          return
        }

        const rate = isPlaying ? shot.cycleRate * 2.75 : shot.cycleRate * 0.45
        const duty = isPlaying ? shot.duty : 0.018
        const cycle = (elapsed * rate + shot.cycleOffset) % 1

        if (cycle >= duty || playingMotionOff || reduced) {
          shot.group.visible = false
          return
        }

        const progress = THREE.MathUtils.clamp(cycle / duty, 0, 1)
        const flare = Math.sin(progress * Math.PI)
        const intensity = flare * (isPlaying ? 1.2 + reactiveKick * 0.45 + reactiveGlobal * 0.2 : 0.2) * volumeScale
        shot.group.visible = true
        shot.coreMaterial.opacity = 0.95 * intensity
        shot.glowMaterial.opacity = 0.24 * intensity
        shot.helixMaterial.opacity = 0.78 * intensity
      })

      lightningArcs.forEach((arc, index) => {
        const enabled = burstEnabled && hasSignal && (reactiveParticles > 0.1 || reactiveKick > 0.2)
        if (!enabled) {
          arc.material.opacity = 0
          return
        }

        const arcPulse = Math.max(0, Math.sin(elapsed * (1.9 + index * 0.3 + reactiveOrbit * 0.25) + arc.phase))
        if (arcPulse < 0.65) {
          arc.material.opacity = 0
          return
        }

        const curve = new THREE.CatmullRomCurve3([
          arc.points[0].clone(),
          arc.points[1].clone().add(new THREE.Vector3((Math.random() - 0.5) * arc.jitter, (Math.random() - 0.5) * arc.jitter, 0)),
          arc.points[2].clone().add(new THREE.Vector3((Math.random() - 0.5) * arc.jitter, (Math.random() - 0.5) * arc.jitter, 0)),
          arc.points[3].clone(),
        ])

        const positions = arc.line.geometry.attributes.position as THREE.BufferAttribute
        const sampled = curve.getPoints(positions.count - 1)
        sampled.forEach((point, pointIndex) => {
          positions.setXYZ(pointIndex, point.x, point.y, point.z)
        })
        positions.needsUpdate = true

        arc.material.opacity = Math.min(0.62, (arcPulse - 0.65) * 1.6 * (1 + reactiveParticles * 0.35))
      })

      sweepBeams.forEach((beam) => {
        const wave = Math.max(0, Math.sin(elapsed * beam.speed + beam.phase))
        const flash = Math.pow(wave, isPlaying ? 6 : 12)
        const intensity = isPlaying
          ? flash * volumeScale * (1.15 + reactiveParticles * 0.42 + reactiveKick * 0.18)
          : 0

        beam.group.position.y = beam.baseY + Math.sin(elapsed * beam.speed * 0.45 + beam.phase) * (playingMotionOff ? 0.05 : 0.25)
        beam.group.rotation.z = Math.sin(elapsed * beam.speed * 0.56 + beam.phase) * (playingMotionOff ? 0.02 : 0.08)
        beam.coreMaterial.opacity = 0.54 * intensity
        beam.glowMaterial.opacity = 0.15 * intensity
      })

      floatingGlyphs.forEach(({ mesh, basePosition, phase }, index) => {
        const detailAmplitude = 0.52 + reactiveParticles * 0.95 + reactiveOrbit * 0.18
        mesh.position.y = basePosition.y + Math.sin(elapsed * 0.32 + phase) * 0.14 * detailAmplitude
        mesh.position.x = basePosition.x + Math.cos(elapsed * 0.18 + phase) * 0.08 * detailAmplitude
        mesh.rotation.z += (index % 2 === 0 ? 1 : -1) * 0.055 * (0.6 + reactiveParticles * 0.8) * delta * kineticScale
      })

      const starDriftScale = 0.42 + reactiveParticles * 0.95 + reactiveGlobal * 0.16
      distantStars.rotation.y += 0.0012 * delta * kineticScale * starDriftScale
      accentStars.rotation.z -= 0.0018 * delta * kineticScale * starDriftScale
      brightStars.rotation.y -= 0.0024 * delta * kineticScale * starDriftScale
      distantStarsMaterial.opacity = starBaseOpacity.distant * (1 + reactiveParticles * 0.1)
      accentStarsMaterial.opacity = starBaseOpacity.accent * (1 + reactiveParticles * 0.16)
      brightStarsMaterial.opacity = starBaseOpacity.bright * (1 + reactiveParticles * 0.22)

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      applyResponsiveLayout()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      timer.disconnect()
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('resize', handleResize)
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      scene.clear()
      renderer.renderLists.dispose()
      renderer.dispose()

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="cosmic-nexus-scene" aria-hidden="true" />
}

export default CosmicNexusTheme
