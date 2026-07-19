import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThemeSceneProps } from '../themeTypes'
import './cosmicNexus.css'

type AnimatedRing = {
  mesh: THREE.Mesh
  rotationSpeed: THREE.Vector3
  baseOpacity: number
  material: THREE.MeshBasicMaterial
}

type TravelingPulse = {
  core: THREE.Mesh
  glow: THREE.Mesh
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  curve: THREE.Curve<THREE.Vector3>
  speed: number
  offset: number
}

type SignalPath = {
  outerMaterial: THREE.MeshBasicMaterial
  innerMaterial: THREE.MeshBasicMaterial
  baseOuterOpacity: number
  baseInnerOpacity: number
}

type Relay = {
  group: THREE.Group
  shell: THREE.Mesh
  shellMaterial: THREE.MeshBasicMaterial
  glow: THREE.Mesh
  glowMaterial: THREE.MeshBasicMaterial
  phase: number
}

type AperturePort = {
  ring: THREE.Mesh
  glow: THREE.Mesh
  ringMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  phase: number
}

type FloatingGlyph = {
  mesh: THREE.LineLoop
  basePosition: THREE.Vector3
  phase: number
}

type RailgunShot = {
  group: THREE.Group
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  accentMaterial: THREE.MeshBasicMaterial
  cycleRate: number
  offset: number
  duty: number
  readyEnabled: boolean
}

type ActivationWave = {
  group: THREE.Group
  material: THREE.MeshBasicMaterial
  delay: number
}

type LaserSweep = {
  group: THREE.Group
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  baseY: number
  baseRotation: number
  phase: number
  speed: number
}

const COLORS = {
  green: 0x39ff14,
  cyan: 0x79fff2,
  pink: 0xff4d7a,
  orange: 0xff7a00,
  violet: 0xa45cff,
  white: 0xe9fffb,
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
    scene.fog = new THREE.FogExp2(0x010104, 0.027)

    const camera = new THREE.PerspectiveCamera(59, mount.clientWidth / mount.clientHeight, 0.1, 120)
    camera.position.set(0, 0, 10)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.style.display = 'block'
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
      spread: number,
      size: number,
      color: number,
      opacity: number,
      minZ: number,
      maxZ: number,
    ) => {
      const positions = new Float32Array(count * 3)

      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * spread
        positions[index * 3 + 1] = (Math.random() - 0.5) * spread * 0.62
        positions[index * 3 + 2] = minZ + Math.random() * (maxZ - minZ)
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

    const distantStars = createStarLayer(1800, 72, 0.025, 0xffffff, 0.64, -42, -8)
    const coloredStars = createStarLayer(440, 58, 0.046, COLORS.violet, 0.5, -28, -2)
    const brightStars = createStarLayer(120, 44, 0.08, COLORS.cyan, 0.75, -18, 1)

    const animatedRings: AnimatedRing[] = []
    const relays: Relay[] = []
    const pulses: TravelingPulse[] = []
    const signalPaths: SignalPath[] = []
    const aperturePorts: AperturePort[] = []
    const floatingGlyphs: FloatingGlyph[] = []
    const railgunShots: RailgunShot[] = []
    const laserSweeps: LaserSweep[] = []
    const activationWaves: ActivationWave[] = []

    const createRelay = (position: THREE.Vector3, scale: number, color: number, phase: number) => {
      const group = new THREE.Group()
      group.position.copy(position)
      group.scale.setScalar(scale)
      world.add(group)

      const coreGeometry = trackGeometry(new THREE.SphereGeometry(0.34, 28, 20))
      const coreMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x05020b }))
      const core = new THREE.Mesh(coreGeometry, coreMaterial)
      group.add(core)

      const shellGeometry = trackGeometry(new THREE.IcosahedronGeometry(0.5, 1))
      const shellMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.64,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const shell = new THREE.Mesh(shellGeometry, shellMaterial)
      group.add(shell)

      const glowGeometry = trackGeometry(new THREE.SphereGeometry(0.72, 26, 18))
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.09,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      group.add(glow)

      const ringData = [
        {
          radius: 0.72,
          tube: 0.014,
          tilt: new THREE.Euler(0.5, 0.2, 0.15),
          speed: new THREE.Vector3(0.05, 0.11, 0.04),
        },
        {
          radius: 0.93,
          tube: 0.012,
          tilt: new THREE.Euler(1.1, 0.35, 0.7),
          speed: new THREE.Vector3(-0.08, 0.04, 0.09),
        },
      ]

      ringData.forEach(({ radius, tube, tilt, speed }, index) => {
        const geometry = trackGeometry(new THREE.TorusGeometry(radius, tube, 10, 80))
        const material = trackMaterial(
          new THREE.MeshBasicMaterial({
            color: index === 0 ? color : COLORS.orange,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        )
        const ring = new THREE.Mesh(geometry, material)
        ring.rotation.copy(tilt)
        group.add(ring)
        animatedRings.push({ mesh: ring, rotationSpeed: speed, baseOpacity: material.opacity, material })
      })

      relays.push({ group, shell, shellMaterial, glow, glowMaterial, phase })
      return group
    }

    // Keep the signature relay geometry outside the central video-safe zone and bias it farther
    // toward the corners so more of the animated network remains visible around the aperture.
    const upperLeftRelay = createRelay(new THREE.Vector3(-6.65, 3.18, -0.35), 0.94, COLORS.green, 0.2)
    const upperRightRelay = createRelay(new THREE.Vector3(6.55, 3.02, -0.65), 0.76, COLORS.orange, 1.7)
    const lowerRightRelay = createRelay(new THREE.Vector3(6.6, -3.18, -0.15), 1.16, COLORS.violet, 3.1)
    const lowerLeftRelay = createRelay(new THREE.Vector3(-6.55, -3.18, -0.75), 0.72, COLORS.pink, 4.5)

    const createCurve = (start: THREE.Vector3, controls: THREE.Vector3[], end: THREE.Vector3) =>
      new THREE.CatmullRomCurve3([start, ...controls, end], false, 'catmullrom', 0.45)

    const createHelixCurve = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      turns: number,
      radius: number,
      pointCount = 120,
    ) => {
      const forward = end.clone().sub(start).normalize()
      const reference = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      const side = new THREE.Vector3().crossVectors(forward, reference).normalize()
      const up = new THREE.Vector3().crossVectors(side, forward).normalize()
      const points: THREE.Vector3[] = []

      for (let index = 0; index <= pointCount; index += 1) {
        const progress = index / pointCount
        const point = start.clone().lerp(end, progress)
        const phase = progress * Math.PI * 2 * turns
        const taperedRadius = THREE.MathUtils.lerp(radius, radius * 0.18, progress)
        point.addScaledVector(side, Math.cos(phase) * taperedRadius)
        point.addScaledVector(up, Math.sin(phase) * taperedRadius)
        points.push(point)
      }

      return new THREE.CatmullRomCurve3(points)
    }

    const pulseCoreGeometry = trackGeometry(new THREE.SphereGeometry(0.055, 12, 10))
    const pulseGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.15, 12, 10))

    const createSignalPath = (
      curve: THREE.Curve<THREE.Vector3>,
      color: number,
      speed: number,
      offset: number,
      thickness = 0.012,
    ) => {
      const outerGeometry = trackGeometry(new THREE.TubeGeometry(curve, 150, thickness * 2.6, 6, false))
      const innerGeometry = trackGeometry(new THREE.TubeGeometry(curve, 150, thickness, 5, false))
      const baseOuterOpacity = 0.08
      const baseInnerOpacity = 0.58

      const outerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: baseOuterOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const innerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: baseInnerOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      world.add(new THREE.Mesh(outerGeometry, outerMaterial))
      world.add(new THREE.Mesh(innerGeometry, innerMaterial))
      signalPaths.push({ outerMaterial, innerMaterial, baseOuterOpacity, baseInnerOpacity })

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
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      ;[offset, offset + 0.5].forEach((pulseOffset) => {
        const core = new THREE.Mesh(pulseCoreGeometry, coreMaterial)
        const glow = new THREE.Mesh(pulseGlowGeometry, glowMaterial)
        world.add(core)
        world.add(glow)
        pulses.push({ core, glow, coreMaterial, glowMaterial, curve, speed, offset: pulseOffset })
      })
    }

    const portRingGeometry = trackGeometry(new THREE.TorusGeometry(0.105, 0.018, 10, 28))
    const portGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.22, 16, 12))

    const createAperturePort = (position: THREE.Vector3, color: number, phase: number) => {
      const ringMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.72,
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
      const ring = new THREE.Mesh(portRingGeometry, ringMaterial)
      const glow = new THREE.Mesh(portGlowGeometry, glowMaterial)
      ring.position.copy(position)
      glow.position.copy(position)
      world.add(ring)
      world.add(glow)
      aperturePorts.push({ ring, glow, ringMaterial, glowMaterial, phase })
    }

    const portTopLeft = new THREE.Vector3(-3.58, 2.36, 0.08)
    const portTopCenter = new THREE.Vector3(0, 2.52, 0.08)
    const portTopRight = new THREE.Vector3(3.58, 2.36, 0.08)
    const portLeft = new THREE.Vector3(-4.3, 0.28, 0.08)
    const portRight = new THREE.Vector3(4.32, -0.32, 0.08)
    const portBottomLeft = new THREE.Vector3(-3.58, -2.36, 0.08)
    const portBottomCenter = new THREE.Vector3(0.12, -2.52, 0.08)
    const portBottomRight = new THREE.Vector3(3.58, -2.36, 0.08)

    createAperturePort(portTopLeft, COLORS.green, 0.22)
    createAperturePort(portTopCenter, COLORS.orange, 0.92)
    createAperturePort(portTopRight, COLORS.orange, 1.7)
    createAperturePort(portLeft, COLORS.cyan, 2.38)
    createAperturePort(portRight, COLORS.pink, 2.9)
    createAperturePort(portBottomLeft, COLORS.green, 4.1)
    createAperturePort(portBottomCenter, COLORS.violet, 4.72)
    createAperturePort(portBottomRight, COLORS.violet, 5.2)

    // Two reusable elliptical shockwaves make signal selection and playback feel like a system
    // ignition event. The center remains hidden by the display, while the expanding perimeter is visible.
    const activationWaveGeometry = trackGeometry(new THREE.TorusGeometry(4.35, 0.024, 8, 180))
    ;[
      { color: COLORS.cyan, delay: 0 },
      { color: COLORS.pink, delay: 0.16 },
    ].forEach(({ color, delay }) => {
      const group = new THREE.Group()
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const ring = new THREE.Mesh(activationWaveGeometry, material)
      ring.scale.y = 0.62
      group.add(ring)
      group.visible = false
      group.position.z = 0.18
      world.add(group)
      activationWaves.push({ group, material, delay })
    })

    // Short feeder curves bring energy from the relay clusters toward the aperture perimeter.
    createSignalPath(
      createCurve(
        upperLeftRelay.position.clone(),
        [new THREE.Vector3(-6.0, 3.6, -0.22), new THREE.Vector3(-4.9, 2.86, -0.04)],
        portTopLeft,
      ),
      COLORS.green,
      0.16,
      0.04,
    )
    createSignalPath(
      createCurve(
        upperRightRelay.position.clone(),
        [new THREE.Vector3(6.0, 3.48, -0.38), new THREE.Vector3(4.88, 2.82, -0.04)],
        portTopRight,
      ),
      COLORS.orange,
      0.15,
      0.18,
    )
    createSignalPath(
      createCurve(
        lowerLeftRelay.position.clone(),
        [new THREE.Vector3(-5.95, -3.58, -0.52), new THREE.Vector3(-4.82, -2.82, -0.04)],
        portBottomLeft,
      ),
      COLORS.pink,
      0.18,
      0.36,
    )
    createSignalPath(
      createCurve(
        lowerRightRelay.position.clone(),
        [new THREE.Vector3(6.0, -3.56, -0.12), new THREE.Vector3(4.95, -2.88, -0.04)],
        portBottomRight,
      ),
      COLORS.violet,
      0.17,
      0.52,
      0.014,
    )

    // Long outbound transmission lines radiate away from the screen so the main motion remains
    // visible in the viewport perimeter instead of being hidden behind the central display.
    createSignalPath(
      createCurve(
        portTopLeft.clone(),
        [new THREE.Vector3(-4.9, 2.9, -0.15), new THREE.Vector3(-7.1, 4.25, -1.9)],
        new THREE.Vector3(-10.4, 4.1, -5.4),
      ),
      COLORS.green,
      0.19,
      0.07,
      0.011,
    )
    createSignalPath(
      createCurve(
        portTopCenter.clone(),
        [new THREE.Vector3(-0.28, 3.0, -0.12), new THREE.Vector3(0.4, 4.3, -1.6)],
        new THREE.Vector3(0.08, 5.45, -4.9),
      ),
      COLORS.orange,
      0.16,
      0.22,
      0.01,
    )
    createSignalPath(
      createCurve(
        portTopRight.clone(),
        [new THREE.Vector3(4.92, 2.9, -0.15), new THREE.Vector3(7.18, 4.32, -1.8)],
        new THREE.Vector3(10.5, 4.18, -5.4),
      ),
      COLORS.orange,
      0.17,
      0.33,
      0.011,
    )
    createSignalPath(
      createCurve(
        portLeft.clone(),
        [new THREE.Vector3(-5.55, 0.34, -0.15), new THREE.Vector3(-8.05, 0.92, -1.9)],
        new THREE.Vector3(-11.1, 0.96, -5.2),
      ),
      COLORS.cyan,
      0.2,
      0.46,
      0.012,
    )
    createSignalPath(
      createCurve(
        portRight.clone(),
        [new THREE.Vector3(5.6, -0.36, -0.15), new THREE.Vector3(8.1, -0.96, -2.0)],
        new THREE.Vector3(11.15, -1.0, -5.2),
      ),
      COLORS.pink,
      0.21,
      0.58,
      0.012,
    )
    createSignalPath(
      createCurve(
        portBottomLeft.clone(),
        [new THREE.Vector3(-4.95, -2.92, -0.15), new THREE.Vector3(-7.26, -4.18, -1.9)],
        new THREE.Vector3(-10.55, -4.18, -5.35),
      ),
      COLORS.pink,
      0.18,
      0.69,
      0.011,
    )
    createSignalPath(
      createCurve(
        portBottomCenter.clone(),
        [new THREE.Vector3(0.18, -3.1, -0.12), new THREE.Vector3(-0.18, -4.25, -1.6)],
        new THREE.Vector3(-0.12, -5.4, -4.9),
      ),
      COLORS.violet,
      0.16,
      0.82,
      0.01,
    )
    createSignalPath(
      createCurve(
        portBottomRight.clone(),
        [new THREE.Vector3(4.98, -2.9, -0.15), new THREE.Vector3(7.3, -4.2, -1.9)],
        new THREE.Vector3(10.6, -4.22, -5.35),
      ),
      COLORS.violet,
      0.19,
      0.93,
      0.011,
    )

    // Hero transmission lanes deliberately continue beyond the camera frustum so a few paths
    // visibly touch the browser edges on fullscreen desktop displays. These stay faint while dormant
    // and become the long-range backbone of the instrument in play mode.
    createSignalPath(
      createCurve(
        portLeft.clone(),
        [new THREE.Vector3(-6.4, 0.62, -0.3), new THREE.Vector3(-11.2, 1.1, -1.8)],
        new THREE.Vector3(-17.4, 1.5, -3.6),
      ),
      COLORS.cyan,
      0.23,
      0.12,
      0.009,
    )
    createSignalPath(
      createCurve(
        portRight.clone(),
        [new THREE.Vector3(6.45, -0.55, -0.3), new THREE.Vector3(11.25, -1.05, -1.8)],
        new THREE.Vector3(17.5, -1.55, -3.6),
      ),
      COLORS.pink,
      0.24,
      0.42,
      0.009,
    )
    createSignalPath(
      createCurve(
        portTopLeft.clone(),
        [new THREE.Vector3(-4.65, 3.35, -0.3), new THREE.Vector3(-5.6, 6.15, -1.8)],
        new THREE.Vector3(-6.35, 9.2, -3.7),
      ),
      COLORS.green,
      0.2,
      0.26,
      0.0085,
    )
    createSignalPath(
      createCurve(
        portTopRight.clone(),
        [new THREE.Vector3(4.75, 3.3, -0.3), new THREE.Vector3(5.85, 6.15, -1.8)],
        new THREE.Vector3(6.6, 9.2, -3.7),
      ),
      COLORS.orange,
      0.21,
      0.66,
      0.0085,
    )
    createSignalPath(
      createCurve(
        portBottomLeft.clone(),
        [new THREE.Vector3(-4.7, -3.35, -0.3), new THREE.Vector3(-5.6, -6.15, -1.8)],
        new THREE.Vector3(-6.3, -9.25, -3.7),
      ),
      COLORS.pink,
      0.21,
      0.54,
      0.0085,
    )
    createSignalPath(
      createCurve(
        portBottomRight.clone(),
        [new THREE.Vector3(4.75, -3.35, -0.3), new THREE.Vector3(5.75, -6.2, -1.8)],
        new THREE.Vector3(6.45, -9.25, -3.7),
      ),
      COLORS.violet,
      0.22,
      0.88,
      0.0085,
    )

    // A couple of deeper background lines keep the field expansive without fighting the safe zone.
    createSignalPath(
      createCurve(
        new THREE.Vector3(-10.8, 2.6, -6.8),
        [new THREE.Vector3(-8.7, 2.2, -4.8), new THREE.Vector3(-6.25, 1.4, -1.8)],
        portLeft,
      ),
      COLORS.cyan,
      0.12,
      0.27,
      0.0085,
    )
    createSignalPath(
      createCurve(
        new THREE.Vector3(10.8, -2.85, -6.8),
        [new THREE.Vector3(8.9, -2.4, -4.8), new THREE.Vector3(6.28, -1.48, -1.8)],
        portRight,
      ),
      COLORS.orange,
      0.12,
      0.74,
      0.0085,
    )

    // Full-path transmission bursts read as actual rave-laser shots rather than hovering projectiles.
    // A straight white core flashes together with a colored corkscrew sheath, then disappears quickly.
    const railgunSpecs = [
      {
        start: portTopLeft.clone(),
        end: new THREE.Vector3(-16.8, 8.7, -3.5),
        turns: 6.2,
        radius: 0.17,
        glow: COLORS.cyan,
        accent: COLORS.green,
      },
      {
        start: portTopCenter.clone(),
        end: new THREE.Vector3(-1.2, 9.5, -3.7),
        turns: 7.4,
        radius: 0.15,
        glow: COLORS.orange,
        accent: COLORS.violet,
      },
      {
        start: portTopRight.clone(),
        end: new THREE.Vector3(16.9, 8.6, -3.5),
        turns: 6.6,
        radius: 0.17,
        glow: COLORS.orange,
        accent: COLORS.pink,
      },
      {
        start: portLeft.clone(),
        end: new THREE.Vector3(-17.7, 1.7, -3.4),
        turns: 5.8,
        radius: 0.16,
        glow: COLORS.cyan,
        accent: COLORS.pink,
      },
      {
        start: portRight.clone(),
        end: new THREE.Vector3(17.7, -1.7, -3.4),
        turns: 5.9,
        radius: 0.16,
        glow: COLORS.pink,
        accent: COLORS.orange,
      },
      {
        start: portBottomLeft.clone(),
        end: new THREE.Vector3(-16.7, -8.8, -3.5),
        turns: 6.4,
        radius: 0.17,
        glow: COLORS.pink,
        accent: COLORS.green,
      },
      {
        start: portBottomCenter.clone(),
        end: new THREE.Vector3(1.1, -9.55, -3.7),
        turns: 7.3,
        radius: 0.15,
        glow: COLORS.violet,
        accent: COLORS.cyan,
      },
      {
        start: portBottomRight.clone(),
        end: new THREE.Vector3(16.8, -8.8, -3.5),
        turns: 6.7,
        radius: 0.17,
        glow: COLORS.violet,
        accent: COLORS.orange,
      },
    ]

    railgunSpecs.forEach(({ start, end, turns, radius, glow, accent }, index) => {
      const group = new THREE.Group()
      group.visible = false
      world.add(group)

      const straightCurve = new THREE.LineCurve3(start, end)
      const helixCurve = createHelixCurve(start, end, turns, radius, 180)
      const coreGeometry = trackGeometry(new THREE.TubeGeometry(straightCurve, 12, 0.012, 6, false))
      const glowGeometry = trackGeometry(new THREE.TubeGeometry(straightCurve, 12, 0.045, 6, false))
      const accentGeometry = trackGeometry(new THREE.TubeGeometry(helixCurve, 180, 0.017, 6, false))

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
          color: glow,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const accentMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      group.add(
        new THREE.Mesh(glowGeometry, glowMaterial),
        new THREE.Mesh(coreGeometry, coreMaterial),
        new THREE.Mesh(accentGeometry, accentMaterial),
      )

      railgunShots.push({
        group,
        coreMaterial,
        glowMaterial,
        accentMaterial,
        cycleRate: 0.15 + (index % 4) * 0.018,
        offset: index * 0.119,
        duty: 0.075 + (index % 3) * 0.012,
        readyEnabled: index < 2,
      })
    })

    const sweepCoreGeometry = trackGeometry(new THREE.CylinderGeometry(0.009, 0.009, 15.5, 6, 1, true))
    const sweepGlowGeometry = trackGeometry(new THREE.CylinderGeometry(0.038, 0.038, 15.5, 6, 1, true))

    const createLaserSweep = (
      baseY: number,
      baseRotation: number,
      color: number,
      phase: number,
      speed: number,
    ) => {
      const group = new THREE.Group()
      group.position.set(0, baseY, -4.5)
      group.rotation.z = baseRotation
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
      const glow = new THREE.Mesh(sweepGlowGeometry, glowMaterial)
      const core = new THREE.Mesh(sweepCoreGeometry, coreMaterial)
      glow.rotation.z = Math.PI / 2
      core.rotation.z = Math.PI / 2
      group.add(glow, core)
      laserSweeps.push({ group, coreMaterial, glowMaterial, baseY, baseRotation, phase, speed })
    }

    createLaserSweep(3.45, -0.035, COLORS.cyan, 0.3, 0.58)
    createLaserSweep(-3.5, 0.045, COLORS.pink, 2.5, 0.47)

    const glyphGeometry = trackGeometry(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.16, -0.16, 0),
        new THREE.Vector3(0.16, -0.16, 0),
        new THREE.Vector3(0.16, 0.16, 0),
        new THREE.Vector3(-0.16, 0.16, 0),
      ]),
    )

    const glyphColors = [COLORS.cyan, COLORS.green, COLORS.pink, COLORS.orange, COLORS.violet]
    for (let index = 0; index < 18; index += 1) {
      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color: glyphColors[index % glyphColors.length],
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const mesh = new THREE.LineLoop(glyphGeometry, material)
      const side = index % 2 === 0 ? -1 : 1
      const basePosition = new THREE.Vector3(
        side * (4.65 + Math.random() * 2.15),
        (Math.random() - 0.5) * 6.1,
        -1.5 - Math.random() * 4,
      )
      mesh.position.copy(basePosition)
      mesh.rotation.z = Math.random() * Math.PI
      mesh.scale.setScalar(0.25 + Math.random() * 0.65)
      world.add(mesh)
      floatingGlyphs.push({ mesh, basePosition, phase: Math.random() * Math.PI * 2 })
    }

    const pointerTarget = new THREE.Vector2()
    const pointerCurrent = new THREE.Vector2()

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
        world.scale.setScalar(0.62)
        world.position.set(0, -0.1, 0)
        camera.fov = 69
      } else if (width < 1000 || aspect < 1.25) {
        world.scale.setScalar(0.8)
        world.position.set(0, 0.02, 0)
        camera.fov = 65
      } else {
        world.scale.setScalar(1)
        world.position.set(0, 0.14, 0)
        camera.fov = 59
      }

      camera.updateProjectionMatrix()
    }

    applyResponsiveLayout()

    const timer = new THREE.Timer()
    timer.connect(document)

    let elapsed = 0
    let animationFrameId = 0
    let previousHasSignal = Boolean(visualStateRef.current.signalId)
    let previousPlaying = visualStateRef.current.isPlaying
    let activationProgress = 1
    let activationStrength = 0

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()

      const state = visualStateRef.current
      const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const reduced = state.reducedMotion || systemReducedMotion
      const motionEnabled = state.motionEnabled ?? true
      const cinematicMotion = motionEnabled && !reduced
      const isPlayingWithMotionOff = state.isPlaying && !motionEnabled
      const hasSignal = Boolean(state.signalId)
      const ready = hasSignal && !state.isPlaying
      const motionScale = reduced ? 0.16 : cinematicMotion ? 1 : 0.08
      const activeScale = state.isPlaying ? 2.45 : ready ? 0.92 : 0.26
      const volumeScale = 0.68 + state.volume * 0.32
      const delta = Math.min(timer.getDelta(), 0.05)
      const travelScale = reduced ? 0 : cinematicMotion ? 1 : state.isPlaying ? 0.08 : 0.38
      const suppressBursts = reduced || !motionEnabled
      elapsed += delta * motionScale

      if (hasSignal && !previousHasSignal) {
        activationProgress = 0
        activationStrength = 0.9
      } else if (state.isPlaying && !previousPlaying) {
        activationProgress = 0
        activationStrength = 1.45
      } else if (!state.isPlaying && previousPlaying) {
        activationProgress = 0
        activationStrength = 0.52
      } else if (!hasSignal && previousHasSignal) {
        activationProgress = 0
        activationStrength = 0.34
      }

      previousHasSignal = hasSignal
      previousPlaying = state.isPlaying

      if (reduced) {
        activationProgress = 1
      } else {
        activationProgress = Math.min(1, activationProgress + delta * (state.isPlaying ? 1.42 : 1.08))
      }

      const transitionBoost = Math.max(0, 1 - activationProgress) * activationStrength

      pointerCurrent.lerp(pointerTarget, reduced ? 0.01 : cinematicMotion ? 0.026 : 0.004)
      world.rotation.y = pointerCurrent.x * 0.022
      world.rotation.x = -pointerCurrent.y * 0.016

      animatedRings.forEach(({ mesh, rotationSpeed, material, baseOpacity }) => {
        const speed = activeScale * volumeScale * (cinematicMotion ? 1 : state.isPlaying ? 0.12 : 0.52)
        mesh.rotation.x += rotationSpeed.x * delta * motionScale * speed
        mesh.rotation.y += rotationSpeed.y * delta * motionScale * speed
        mesh.rotation.z += rotationSpeed.z * delta * motionScale * speed
        material.opacity = baseOpacity * (0.58 + activeScale * 0.28)
      })

      relays.forEach(({ group, shell, shellMaterial, glow, glowMaterial, phase }) => {
        shell.rotation.x += 0.04 * delta * motionScale * activeScale * (cinematicMotion ? 1 : 0.14)
        shell.rotation.y -= 0.07 * delta * motionScale * activeScale * (cinematicMotion ? 1 : 0.14)
        const pulse = 1 + Math.sin(elapsed * (1.05 + activeScale * 0.7) + phase) * (state.isPlaying ? 0.13 : 0.045)
        glow.scale.setScalar(pulse)
        const calmGlowFloor = isPlayingWithMotionOff ? 0.075 : state.isPlaying ? 0.19 : ready ? 0.09 : 0.035
        glowMaterial.opacity = (calmGlowFloor + transitionBoost * (isPlayingWithMotionOff ? 0.028 : 0.08)) * volumeScale
        shellMaterial.opacity = Math.min(1, (state.isPlaying ? 0.88 : ready ? 0.6 : 0.3) + transitionBoost * 0.18)
        group.rotation.z = Math.sin(elapsed * 0.18 + phase) * (isPlayingWithMotionOff ? 0.009 : 0.035)
      })

      const pathPower = (state.isPlaying ? 1.55 : ready ? 0.86 : 0.14) + transitionBoost * 0.42
      signalPaths.forEach(({ outerMaterial, innerMaterial, baseOuterOpacity, baseInnerOpacity }) => {
        outerMaterial.opacity = Math.min(1, baseOuterOpacity * pathPower * volumeScale)
        innerMaterial.opacity = Math.min(1, baseInnerOpacity * pathPower * volumeScale)
      })

      pulses.forEach(({ core, glow, coreMaterial, glowMaterial, curve, speed, offset }) => {
        const effectiveSpeed = speed * (state.isPlaying ? 3.35 : ready ? 0.96 : 0.12) * travelScale
        const progress = (elapsed * effectiveSpeed + offset) % 1
        const point = curve.getPointAt(progress)
        core.position.copy(point)
        glow.position.copy(point)
        const scale = 0.82 + Math.sin(progress * Math.PI * 2) * 0.18
        core.scale.setScalar(scale * (state.isPlaying ? 1.08 : 1))
        glow.scale.setScalar(scale * (state.isPlaying ? 1.82 : ready ? 1.0 : 0.65))
        coreMaterial.opacity = state.isPlaying ? 1 : ready ? 0.76 : 0.24
        glowMaterial.opacity = (state.isPlaying ? (isPlayingWithMotionOff ? 0.08 : 0.34) : ready ? 0.15 : 0.04) * volumeScale
      })

      aperturePorts.forEach(({ ring, glow, ringMaterial, glowMaterial, phase }) => {
        const beat = (Math.sin(elapsed * (state.isPlaying ? 3.0 : 1.1) + phase) + 1) * 0.5
        ring.scale.setScalar(1 + beat * (state.isPlaying ? (isPlayingWithMotionOff ? 0.04 : 0.18) : 0.06))
        glow.scale.setScalar(0.85 + beat * (state.isPlaying ? (isPlayingWithMotionOff ? 0.18 : 0.75) : 0.25))
        ringMaterial.opacity = state.isPlaying ? (isPlayingWithMotionOff ? 0.72 + beat * 0.06 : 0.78 + beat * 0.22) : ready ? 0.58 + beat * 0.14 : 0.3
        glowMaterial.opacity = (state.isPlaying ? (isPlayingWithMotionOff ? 0.07 + beat * 0.05 : 0.15 + beat * 0.16) : ready ? 0.07 + beat * 0.05 : 0.025) * volumeScale
      })

      activationWaves.forEach(({ group, material, delay }) => {
        const localProgress = THREE.MathUtils.clamp((activationProgress - delay) / Math.max(0.001, 1 - delay), 0, 1)
        const active = activationProgress < 1 && localProgress > 0 && localProgress < 1
        group.visible = active

        if (!active) {
          material.opacity = 0
          return
        }

        const flare = Math.sin(localProgress * Math.PI)
        group.scale.setScalar(0.58 + localProgress * 1.62)
        material.opacity = flare * activationStrength * 0.42 * volumeScale
      })

      railgunShots.forEach((shot) => {
        if (suppressBursts || !hasSignal || (!state.isPlaying && !shot.readyEnabled)) {
          shot.group.visible = false
          return
        }

        const rateMultiplier = state.isPlaying ? 2.65 : 0.34
        const duty = state.isPlaying ? shot.duty : 0.018
        const cycle = (elapsed * shot.cycleRate * rateMultiplier + shot.offset) % 1

        if (cycle >= duty) {
          shot.group.visible = false
          return
        }

        const progress = THREE.MathUtils.clamp(cycle / duty, 0, 1)
        const flare = Math.sin(progress * Math.PI)
        const intensity = (state.isPlaying ? 1.18 : 0.16) * volumeScale * flare
        shot.group.visible = true
        shot.coreMaterial.opacity = 0.92 * intensity
        shot.glowMaterial.opacity = 0.2 * intensity
        shot.accentMaterial.opacity = 0.78 * intensity
      })

      laserSweeps.forEach(({ group, coreMaterial, glowMaterial, baseY, baseRotation, phase, speed }) => {
        const wave = Math.max(0, Math.sin(elapsed * speed + phase))
        const flash = Math.pow(wave, state.isPlaying ? 7 : 13)
        const intensity = state.isPlaying
          ? flash * volumeScale * (isPlayingWithMotionOff ? 0.32 : 1.22)
          : ready
            ? flash * 0.1
            : 0
        group.position.y = baseY + Math.sin(elapsed * speed * 0.52 + phase) * (isPlayingWithMotionOff ? 0.04 : 0.24)
        group.rotation.z = baseRotation + Math.sin(elapsed * speed * 0.58 + phase) * (isPlayingWithMotionOff ? 0.014 : 0.08)
        coreMaterial.opacity = 0.5 * intensity
        glowMaterial.opacity = 0.135 * intensity
      })

      floatingGlyphs.forEach(({ mesh, basePosition, phase }, index) => {
        mesh.position.y = basePosition.y + Math.sin(elapsed * 0.35 + phase) * (isPlayingWithMotionOff ? 0.03 : 0.16)
        mesh.position.x = basePosition.x + Math.cos(elapsed * 0.22 + phase) * (isPlayingWithMotionOff ? 0.02 : 0.08)
        mesh.rotation.z += (index % 2 === 0 ? 1 : -1) * (isPlayingWithMotionOff ? 0.01 : 0.06) * delta * motionScale
      })

      distantStars.rotation.y += 0.0015 * delta * motionScale
      coloredStars.rotation.z -= 0.0022 * delta * motionScale
      brightStars.rotation.y -= 0.003 * delta * motionScale

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
      window.cancelAnimationFrame(animationFrameId)
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
