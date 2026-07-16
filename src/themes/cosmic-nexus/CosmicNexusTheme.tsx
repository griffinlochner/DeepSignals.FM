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
  tipMaterial: THREE.MeshBasicMaterial
  curve: THREE.Curve<THREE.Vector3>
  cycleRate: number
  offset: number
  duty: number
  readyEnabled: boolean
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

const Y_AXIS = new THREE.Vector3(0, 1, 0)

function CosmicNexusTheme(props: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const visualStateRef = useRef(props)
  visualStateRef.current = props

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

    const apertureGroup = new THREE.Group()
    apertureGroup.position.z = -0.7
    world.add(apertureGroup)

    const animatedRings: AnimatedRing[] = []
    const relays: Relay[] = []
    const pulses: TravelingPulse[] = []
    const signalPaths: SignalPath[] = []
    const aperturePorts: AperturePort[] = []
    const floatingGlyphs: FloatingGlyph[] = []
    const railgunShots: RailgunShot[] = []
    const laserSweeps: LaserSweep[] = []

    const createRoundedRectPoints = (width: number, height: number, radius: number, segments = 12) => {
      const points: THREE.Vector3[] = []
      const corners = [
        { cx: width / 2 - radius, cy: height / 2 - radius, start: 0 },
        { cx: -width / 2 + radius, cy: height / 2 - radius, start: Math.PI / 2 },
        { cx: -width / 2 + radius, cy: -height / 2 + radius, start: Math.PI },
        { cx: width / 2 - radius, cy: -height / 2 + radius, start: Math.PI * 1.5 },
      ]

      corners.forEach(({ cx, cy, start }) => {
        for (let index = 0; index <= segments; index += 1) {
          const angle = start + (index / segments) * (Math.PI / 2)
          points.push(new THREE.Vector3(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0))
        }
      })

      return points
    }

    const createApertureOutline = (width: number, height: number, color: number, opacity: number, z: number) => {
      const points = createRoundedRectPoints(width, height, 0.18)
      const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints(points))
      const material = trackMaterial(
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const line = new THREE.LineLoop(geometry, material)
      line.position.z = z
      apertureGroup.add(line)
      return { line, material }
    }

    const outerAperture = createApertureOutline(8.55, 5.05, COLORS.cyan, 0.18, -0.04)
    const middleAperture = createApertureOutline(8.16, 4.72, COLORS.violet, 0.24, 0)
    const innerAperture = createApertureOutline(7.78, 4.38, COLORS.green, 0.22, 0.04)

    const haloGeometry = trackGeometry(new THREE.PlaneGeometry(9.35, 5.7))
    const haloMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: COLORS.violet,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const halo = new THREE.Mesh(haloGeometry, haloMaterial)
    halo.position.z = -0.15
    apertureGroup.add(halo)

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

    // Keep the signature relay geometry outside the central video-safe zone.
    const upperLeftRelay = createRelay(new THREE.Vector3(-5.95, 2.82, -0.35), 0.9, COLORS.green, 0.2)
    const upperRightRelay = createRelay(new THREE.Vector3(5.85, 2.62, -0.65), 0.72, COLORS.orange, 1.7)
    const lowerRightRelay = createRelay(new THREE.Vector3(5.95, -2.82, -0.15), 1.12, COLORS.violet, 3.1)
    const lowerLeftRelay = createRelay(new THREE.Vector3(-5.9, -2.85, -0.75), 0.66, COLORS.pink, 4.5)

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

    const portLeft = new THREE.Vector3(-4.28, 0.35, 0.08)
    const portTopRight = new THREE.Vector3(3.35, 2.36, 0.08)
    const portRight = new THREE.Vector3(4.28, -0.42, 0.08)
    const portBottomLeft = new THREE.Vector3(-3.35, -2.36, 0.08)
    const portBottomRight = new THREE.Vector3(3.35, -2.36, 0.08)

    createAperturePort(portLeft, COLORS.cyan, 0.4)
    createAperturePort(portTopRight, COLORS.orange, 1.7)
    createAperturePort(portRight, COLORS.pink, 2.9)
    createAperturePort(portBottomLeft, COLORS.green, 4.1)
    createAperturePort(portBottomRight, COLORS.violet, 5.2)

    createSignalPath(
      createCurve(
        upperLeftRelay.position.clone(),
        [new THREE.Vector3(-5.35, 3.35, -0.2), new THREE.Vector3(-4.72, 1.4, 0)],
        portLeft,
      ),
      COLORS.green,
      0.17,
      0.08,
    )
    createSignalPath(
      createCurve(
        upperRightRelay.position.clone(),
        [new THREE.Vector3(5.2, 3.2, -0.5), new THREE.Vector3(4.25, 2.75, 0)],
        portTopRight,
      ),
      COLORS.orange,
      0.13,
      0.36,
    )
    createSignalPath(
      createCurve(
        lowerRightRelay.position.clone(),
        [new THREE.Vector3(5.15, -3.3, -0.1), new THREE.Vector3(4.65, -1.5, 0)],
        portRight,
      ),
      COLORS.violet,
      0.19,
      0.6,
      0.014,
    )
    createSignalPath(
      createCurve(
        lowerLeftRelay.position.clone(),
        [new THREE.Vector3(-5.15, -3.35, -0.65), new THREE.Vector3(-4.15, -2.75, 0)],
        portBottomLeft,
      ),
      COLORS.pink,
      0.21,
      0.82,
    )
    createSignalPath(
      createCurve(
        new THREE.Vector3(-7.6, 0.1, -4),
        [new THREE.Vector3(-6.2, -0.9, -2), new THREE.Vector3(-5.05, -0.6, -0.7)],
        portLeft,
      ),
      COLORS.cyan,
      0.15,
      0.25,
      0.01,
    )
    createSignalPath(
      createCurve(
        new THREE.Vector3(7.45, -3.8, -4.5),
        [new THREE.Vector3(6.1, -3.65, -2), new THREE.Vector3(4.4, -2.8, -0.6)],
        portBottomRight,
      ),
      COLORS.orange,
      0.145,
      0.48,
      0.009,
    )

    // A small reusable railgun pool: nested additive cylinders travel on
    // corkscrew curves near the perimeter instead of crossing the display.
    const shotCoreGeometry = trackGeometry(new THREE.CylinderGeometry(0.017, 0.025, 0.9, 8, 1, true))
    const shotGlowGeometry = trackGeometry(new THREE.CylinderGeometry(0.055, 0.075, 1.45, 8, 1, true))
    const shotAccentGeometry = trackGeometry(new THREE.CylinderGeometry(0.028, 0.04, 0.52, 8, 1, true))
    const shotTipGeometry = trackGeometry(new THREE.SphereGeometry(0.06, 12, 10))

    const railgunCurves = [
      createHelixCurve(new THREE.Vector3(-8.6, 4.15, -6), new THREE.Vector3(-4.45, 2.6, -0.2), 4.5, 0.24),
      createHelixCurve(new THREE.Vector3(8.6, 4.0, -7), new THREE.Vector3(4.45, 2.35, -0.25), 5.2, 0.22),
      createHelixCurve(new THREE.Vector3(-8.4, -4.05, -6), new THREE.Vector3(-4.4, -2.55, -0.2), 4.2, 0.21),
      createHelixCurve(new THREE.Vector3(8.5, -4.15, -7), new THREE.Vector3(4.45, -2.5, -0.25), 5.1, 0.23),
    ]

    const railgunColors = [
      [COLORS.cyan, COLORS.pink],
      [COLORS.orange, COLORS.violet],
      [COLORS.pink, COLORS.green],
      [COLORS.violet, COLORS.cyan],
      [COLORS.green, COLORS.orange],
      [COLORS.cyan, COLORS.violet],
    ] as const

    for (let index = 0; index < 6; index += 1) {
      const [glowColor, accentColor] = railgunColors[index]
      const group = new THREE.Group()
      group.visible = false
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
          color: glowColor,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const accentMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: accentColor,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const tipMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: accentColor,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const glow = new THREE.Mesh(shotGlowGeometry, glowMaterial)
      const core = new THREE.Mesh(shotCoreGeometry, coreMaterial)
      const accent = new THREE.Mesh(shotAccentGeometry, accentMaterial)
      const tip = new THREE.Mesh(shotTipGeometry, tipMaterial)
      accent.position.y = -0.42
      tip.position.y = 0.5
      group.add(glow, core, accent, tip)

      railgunShots.push({
        group,
        coreMaterial,
        glowMaterial,
        accentMaterial,
        tipMaterial,
        curve: railgunCurves[index % railgunCurves.length],
        cycleRate: 0.14 + (index % 3) * 0.025,
        offset: index * 0.163,
        duty: 0.09 + (index % 2) * 0.025,
        readyEnabled: index < 2,
      })
    }

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

    const shotTangent = new THREE.Vector3()
    let elapsed = 0
    let animationFrameId = 0

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()

      const state = visualStateRef.current
      const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const reduced = state.reducedMotion || systemReducedMotion
      const hasSignal = Boolean(state.signalId)
      const ready = hasSignal && !state.isPlaying
      const motionScale = reduced ? 0.16 : 1
      const activeScale = state.isPlaying ? 1.65 : ready ? 0.82 : 0.42
      const volumeScale = 0.7 + state.volume * 0.3
      const delta = Math.min(timer.getDelta(), 0.05)
      elapsed += delta * motionScale

      pointerCurrent.lerp(pointerTarget, reduced ? 0.01 : 0.026)
      world.rotation.y = pointerCurrent.x * 0.022
      world.rotation.x = -pointerCurrent.y * 0.016

      animatedRings.forEach(({ mesh, rotationSpeed, material, baseOpacity }) => {
        const speed = activeScale * volumeScale
        mesh.rotation.x += rotationSpeed.x * delta * motionScale * speed
        mesh.rotation.y += rotationSpeed.y * delta * motionScale * speed
        mesh.rotation.z += rotationSpeed.z * delta * motionScale * speed
        material.opacity = baseOpacity * (0.58 + activeScale * 0.28)
      })

      relays.forEach(({ group, shell, shellMaterial, glow, glowMaterial, phase }) => {
        shell.rotation.x += 0.04 * delta * motionScale * activeScale
        shell.rotation.y -= 0.07 * delta * motionScale * activeScale
        const pulse = 1 + Math.sin(elapsed * (1.05 + activeScale * 0.7) + phase) * (state.isPlaying ? 0.13 : 0.045)
        glow.scale.setScalar(pulse)
        glowMaterial.opacity = (state.isPlaying ? 0.17 : ready ? 0.085 : 0.045) * volumeScale
        shellMaterial.opacity = state.isPlaying ? 0.82 : ready ? 0.58 : 0.34
        group.rotation.z = Math.sin(elapsed * 0.18 + phase) * 0.035
      })

      const pathPower = state.isPlaying ? 1.24 : ready ? 0.72 : 0.28
      signalPaths.forEach(({ outerMaterial, innerMaterial, baseOuterOpacity, baseInnerOpacity }) => {
        outerMaterial.opacity = baseOuterOpacity * pathPower * volumeScale
        innerMaterial.opacity = baseInnerOpacity * pathPower * volumeScale
      })

      pulses.forEach(({ core, glow, coreMaterial, glowMaterial, curve, speed, offset }) => {
        const effectiveSpeed = speed * (state.isPlaying ? 2.0 : ready ? 0.78 : 0.22)
        const progress = (elapsed * effectiveSpeed + offset) % 1
        const point = curve.getPointAt(progress)
        core.position.copy(point)
        glow.position.copy(point)
        const scale = 0.82 + Math.sin(progress * Math.PI * 2) * 0.18
        core.scale.setScalar(scale)
        glow.scale.setScalar(scale * (state.isPlaying ? 1.55 : ready ? 0.92 : 0.65))
        coreMaterial.opacity = state.isPlaying ? 1 : ready ? 0.72 : 0.28
        glowMaterial.opacity = (state.isPlaying ? 0.28 : ready ? 0.13 : 0.045) * volumeScale
      })

      aperturePorts.forEach(({ ring, glow, ringMaterial, glowMaterial, phase }) => {
        const beat = (Math.sin(elapsed * (state.isPlaying ? 3.0 : 1.1) + phase) + 1) * 0.5
        ring.scale.setScalar(1 + beat * (state.isPlaying ? 0.18 : 0.06))
        glow.scale.setScalar(0.85 + beat * (state.isPlaying ? 0.75 : 0.25))
        ringMaterial.opacity = state.isPlaying ? 0.78 + beat * 0.22 : ready ? 0.58 + beat * 0.14 : 0.3
        glowMaterial.opacity = (state.isPlaying ? 0.15 + beat * 0.16 : ready ? 0.07 + beat * 0.05 : 0.025) * volumeScale
      })

      const aperturePulse = (Math.sin(elapsed * (state.isPlaying ? 2.7 : 0.8)) + 1) * 0.5
      outerAperture.material.opacity = 0.1 + aperturePulse * (state.isPlaying ? 0.24 : ready ? 0.09 : 0.035)
      middleAperture.material.opacity = 0.14 + aperturePulse * (state.isPlaying ? 0.28 : ready ? 0.1 : 0.04)
      innerAperture.material.opacity = 0.14 + aperturePulse * (state.isPlaying ? 0.34 : ready ? 0.11 : 0.04)
      haloMaterial.opacity = state.isPlaying ? 0.075 + aperturePulse * 0.05 : ready ? 0.033 : 0.018

      railgunShots.forEach((shot) => {
        if (reduced || !hasSignal || (!state.isPlaying && !shot.readyEnabled)) {
          shot.group.visible = false
          return
        }

        const rateMultiplier = state.isPlaying ? 1.35 : 0.42
        const duty = state.isPlaying ? shot.duty : 0.035
        const cycle = (elapsed * shot.cycleRate * rateMultiplier + shot.offset) % 1

        if (cycle >= duty) {
          shot.group.visible = false
          return
        }

        const progress = THREE.MathUtils.clamp(cycle / duty, 0, 1)
        const flare = Math.sin(progress * Math.PI)
        const point = shot.curve.getPointAt(progress)
        shot.curve.getTangentAt(progress, shotTangent).normalize()
        shot.group.visible = true
        shot.group.position.copy(point)
        shot.group.quaternion.setFromUnitVectors(Y_AXIS, shotTangent)
        shot.group.scale.setScalar((state.isPlaying ? 0.95 : 0.7) + flare * 0.28)

        const intensity = (state.isPlaying ? 1 : 0.22) * volumeScale * flare
        shot.coreMaterial.opacity = 0.92 * intensity
        shot.glowMaterial.opacity = 0.28 * intensity
        shot.accentMaterial.opacity = 0.72 * intensity
        shot.tipMaterial.opacity = 0.95 * intensity
      })

      laserSweeps.forEach(({ group, coreMaterial, glowMaterial, baseY, baseRotation, phase, speed }) => {
        const wave = Math.max(0, Math.sin(elapsed * speed + phase))
        const flash = Math.pow(wave, state.isPlaying ? 8 : 14)
        const intensity = state.isPlaying ? flash * volumeScale : ready ? flash * 0.08 : 0
        group.position.y = baseY + Math.sin(elapsed * speed * 0.36 + phase) * 0.18
        group.rotation.z = baseRotation + Math.sin(elapsed * speed * 0.42 + phase) * 0.055
        coreMaterial.opacity = 0.42 * intensity
        glowMaterial.opacity = 0.1 * intensity
      })

      floatingGlyphs.forEach(({ mesh, basePosition, phase }, index) => {
        mesh.position.y = basePosition.y + Math.sin(elapsed * 0.35 + phase) * 0.16
        mesh.position.x = basePosition.x + Math.cos(elapsed * 0.22 + phase) * 0.08
        mesh.rotation.z += (index % 2 === 0 ? 1 : -1) * 0.06 * delta * motionScale
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
