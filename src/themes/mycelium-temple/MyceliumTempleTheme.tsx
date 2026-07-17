import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThemeSceneProps } from '../themeTypes'
import './myceliumTemple.css'

type HueBinding = {
  material: THREE.MeshBasicMaterial
  baseHue: number
  saturation: number
  dormantLightness: number
  activeLightness: number
  phase: number
  opacity: number
}

type LivingPlant = {
  group: THREE.Group
  phase: number
  sway: number
  baseScale: number
  bloom?: THREE.Group
  bloomBaseScale?: number
  distanceFromCenter: number
}

type CanopyLeaf = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  phase: number
  baseRotation: THREE.Euler
  baseHue: number
}

type RootPulse = {
  core: THREE.Mesh
  glow: THREE.Mesh
  coreMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  curve: THREE.Curve<THREE.Vector3>
  offset: number
  speed: number
}

type RootPath = {
  barkMaterial: THREE.MeshBasicMaterial
  sapMaterial: THREE.MeshBasicMaterial
  baseHue: number
  phase: number
}

type ResonanceBloom = {
  group: THREE.Group
  petals: THREE.Group[]
  center: THREE.Mesh
  centerMaterial: THREE.MeshBasicMaterial
  ring: THREE.Mesh
  ringMaterial: THREE.MeshBasicMaterial
  phase: number
  baseScale: number
}

type MistBand = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  baseX: number
  baseY: number
  phase: number
  speed: number
}

type BioRipple = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  active: boolean
  startTime: number
  duration: number
  maxScale: number
}

const COLORS = {
  cyan: 0x63ffe6,
  green: 0x62ff6d,
  acid: 0xc8ff3d,
  violet: 0xa566ff,
  magenta: 0xff4fc8,
  coral: 0xff765d,
  amber: 0xffc65b,
  pale: 0xeaffdf,
  bark: 0x07100d,
}


function clampHue(value: number) {
  return ((value % 1) + 1) % 1
}

function MyceliumTempleTheme(props: ThemeSceneProps) {
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
    scene.background = new THREE.Color(0x010705)
    scene.fog = new THREE.FogExp2(0x010705, 0.035)

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 140)
    camera.position.set(0, 0.05, 10)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
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

    const hueBindings: HueBinding[] = []
    const livingPlants: LivingPlant[] = []
    const canopyLeaves: CanopyLeaf[] = []
    const rootPaths: RootPath[] = []
    const rootPulses: RootPulse[] = []
    const resonanceBlooms: ResonanceBloom[] = []
    const mistBands: MistBand[] = []
    const ripples: BioRipple[] = []
    const secondaryDetails: THREE.Object3D[] = []

    const createLeafGeometry = () => {
      const shape = new THREE.Shape()
      shape.moveTo(0, 0)
      shape.bezierCurveTo(-0.32, 0.3, -0.46, 1.15, 0, 1.72)
      shape.bezierCurveTo(0.46, 1.15, 0.32, 0.3, 0, 0)
      return trackGeometry(new THREE.ShapeGeometry(shape, 18))
    }

    const createPetalGeometry = () => {
      const shape = new THREE.Shape()
      shape.moveTo(0, 0)
      shape.bezierCurveTo(-0.36, 0.22, -0.42, 0.82, 0, 1.08)
      shape.bezierCurveTo(0.42, 0.82, 0.36, 0.22, 0, 0)
      return trackGeometry(new THREE.ShapeGeometry(shape, 16))
    }

    const leafGeometry = createLeafGeometry()
    const petalGeometry = createPetalGeometry()
    const stemGeometry = trackGeometry(new THREE.CylinderGeometry(0.035, 0.075, 1.9, 9))
    const thinStemGeometry = trackGeometry(new THREE.CylinderGeometry(0.02, 0.045, 1.45, 8))
    const bloomCenterGeometry = trackGeometry(new THREE.SphereGeometry(0.22, 20, 14))
    const pulseCoreGeometry = trackGeometry(new THREE.SphereGeometry(0.045, 12, 10))
    const pulseGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.14, 12, 10))
    const rippleGeometry = trackGeometry(new THREE.TorusGeometry(1, 0.018, 8, 128))

    const registerHueMaterial = (
      material: THREE.MeshBasicMaterial,
      baseHue: number,
      saturation: number,
      dormantLightness: number,
      activeLightness: number,
      phase: number,
      opacity: number,
    ) => {
      hueBindings.push({
        material,
        baseHue,
        saturation,
        dormantLightness,
        activeLightness,
        phase,
        opacity,
      })
      return material
    }

    const makeHueMaterial = (
      baseHue: number,
      phase: number,
      opacity = 0.82,
      dormantLightness = 0.11,
      activeLightness = 0.58,
    ) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue, 0.92, dormantLightness),
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      return registerHueMaterial(material, baseHue, 0.92, dormantLightness, activeLightness, phase, opacity)
    }

    const createTrunk = (x: number, rotationZ: number, scale: number, hue: number) => {
      const trunkGeometry = trackGeometry(new THREE.CylinderGeometry(0.62, 1.05, 10.8, 9))
      const trunkMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x06110c,
          transparent: true,
          opacity: 0.96,
        }),
      )
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
      trunk.position.set(x, 0.35, -3.25)
      trunk.rotation.z = rotationZ
      trunk.scale.setScalar(scale)
      world.add(trunk)

      const veinCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x * 0.96, -4.8, -2.7),
        new THREE.Vector3(x * 0.985, -2.1, -2.4),
        new THREE.Vector3(x * 0.95, 0.7, -2.25),
        new THREE.Vector3(x * 1.02, 3.2, -2.3),
        new THREE.Vector3(x * 0.98, 5.2, -2.65),
      ])
      const veinGeometry = trackGeometry(new THREE.TubeGeometry(veinCurve, 100, 0.024, 6, false))
      const veinMaterial = makeHueMaterial(hue, Math.abs(x), 0.34, 0.055, 0.46)
      const vein = new THREE.Mesh(veinGeometry, veinMaterial)
      world.add(vein)
    }

    createTrunk(-8.15, -0.055, 1.06, 0.34)
    createTrunk(8.05, 0.06, 1.02, 0.78)

    const createCanopyLeaf = (
      position: THREE.Vector3,
      scale: THREE.Vector3,
      rotation: THREE.Euler,
      baseHue: number,
      phase: number,
      secondary = false,
    ) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue, 0.74, 0.08),
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      const leaf = new THREE.Mesh(leafGeometry, material)
      leaf.position.copy(position)
      leaf.scale.copy(scale)
      leaf.rotation.copy(rotation)
      world.add(leaf)
      canopyLeaves.push({
        mesh: leaf,
        material,
        phase,
        baseRotation: rotation.clone(),
        baseHue,
      })

      if (secondary) {
        secondaryDetails.push(leaf)
      }
    }

    const canopySpecs = [
      [-7.7, 4.0, -2.0, 2.4, 2.2, 1.0, -1.35, 0.16, 0.1],
      [-6.0, 4.35, -2.7, 2.0, 2.65, 1.0, -1.05, 0.38, 0.8],
      [-4.25, 4.55, -3.2, 1.8, 2.45, 1.0, -0.78, 0.79, 1.4],
      [-2.0, 4.8, -3.6, 1.7, 2.2, 1.0, -0.36, 0.34, 2.0],
      [2.0, 4.78, -3.6, 1.7, 2.2, 1.0, 0.36, 0.78, 2.5],
      [4.35, 4.52, -3.2, 1.8, 2.45, 1.0, 0.78, 0.91, 3.0],
      [6.15, 4.35, -2.7, 2.0, 2.65, 1.0, 1.05, 0.49, 3.5],
      [7.8, 4.05, -2.0, 2.4, 2.2, 1.0, 1.35, 0.13, 4.1],
      [-8.4, 1.8, -1.8, 1.6, 2.0, 1.0, -1.62, 0.83, 4.8],
      [8.35, 1.7, -1.8, 1.6, 2.0, 1.0, 1.62, 0.31, 5.3],
    ] as const

    canopySpecs.forEach((spec, index) => {
      const [x, y, z, sx, sy, sz, rz, hue, phase] = spec
      createCanopyLeaf(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(sx, sy, sz),
        new THREE.Euler(0.12, index % 2 === 0 ? 0.3 : -0.3, rz),
        hue,
        phase,
        index === 3 || index === 4,
      )
    })

    const createExoticPlant = (
      position: THREE.Vector3,
      scale: number,
      baseHue: number,
      phase: number,
      leafCount: number,
      secondary = false,
    ) => {
      const group = new THREE.Group()
      group.position.copy(position)
      group.scale.setScalar(scale)
      world.add(group)

      const stemMaterial = makeHueMaterial(clampHue(baseHue + 0.08), phase, 0.46, 0.045, 0.34)
      const stem = new THREE.Mesh(stemGeometry, stemMaterial)
      stem.position.y = 0.88
      group.add(stem)

      for (let index = 0; index < leafCount; index += 1) {
        const leafHue = clampHue(baseHue + index * 0.055)
        const leafMaterial = makeHueMaterial(leafHue, phase + index * 0.43, 0.78, 0.08, 0.6)
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial)
        const side = index % 2 === 0 ? -1 : 1
        const spread = 0.28 + index * 0.15
        leaf.position.set(side * 0.08, 0.38 + index * 0.19, index * -0.018)
        leaf.rotation.z = side * spread
        leaf.rotation.y = side * (0.16 + index * 0.07)
        leaf.scale.set(0.62 + index * 0.07, 0.64 + index * 0.055, 1)
        group.add(leaf)
      }

      const plant: LivingPlant = {
        group,
        phase,
        sway: 0.022 + Math.random() * 0.028,
        baseScale: scale,
        distanceFromCenter: Math.abs(position.x) + Math.abs(position.y) * 0.4,
      }
      livingPlants.push(plant)

      if (secondary) {
        secondaryDetails.push(group)
      }

      return group
    }

    const createOrchidBloom = (
      position: THREE.Vector3,
      scale: number,
      baseHue: number,
      phase: number,
      secondary = false,
    ) => {
      const group = new THREE.Group()
      group.position.copy(position)
      group.scale.setScalar(scale)
      world.add(group)

      const stemMaterial = makeHueMaterial(clampHue(baseHue + 0.23), phase, 0.42, 0.04, 0.3)
      const stem = new THREE.Mesh(thinStemGeometry, stemMaterial)
      stem.position.y = -0.68
      group.add(stem)

      const bloom = new THREE.Group()
      group.add(bloom)

      for (let index = 0; index < 7; index += 1) {
        const petalGroup = new THREE.Group()
        petalGroup.rotation.z = (index / 7) * Math.PI * 2
        bloom.add(petalGroup)

        const material = makeHueMaterial(
          clampHue(baseHue + index * 0.04),
          phase + index * 0.4,
          0.9,
          0.08,
          0.66,
        )
        const petal = new THREE.Mesh(petalGeometry, material)
        petal.position.y = 0.03
        petal.rotation.x = 0.1
        petal.scale.set(0.76, 0.86, 1)
        petalGroup.add(petal)
      }

      const centerMaterial = makeHueMaterial(clampHue(baseHue + 0.5), phase + 0.6, 1, 0.12, 0.76)
      const center = new THREE.Mesh(bloomCenterGeometry, centerMaterial)
      bloom.add(center)

      livingPlants.push({
        group,
        phase,
        sway: 0.018 + Math.random() * 0.025,
        baseScale: scale,
        bloom,
        bloomBaseScale: 1,
        distanceFromCenter: Math.abs(position.x) + Math.abs(position.y) * 0.4,
      })

      if (secondary) {
        secondaryDetails.push(group)
      }
    }

    const createPitcherPlant = (
      position: THREE.Vector3,
      scale: number,
      baseHue: number,
      phase: number,
      secondary = false,
    ) => {
      const group = new THREE.Group()
      group.position.copy(position)
      group.scale.setScalar(scale)
      world.add(group)

      const stemMaterial = makeHueMaterial(clampHue(baseHue + 0.17), phase, 0.44, 0.04, 0.33)
      const stem = new THREE.Mesh(thinStemGeometry, stemMaterial)
      stem.position.y = -0.5
      group.add(stem)

      const cupGeometry = trackGeometry(new THREE.ConeGeometry(0.42, 1.15, 20, 1, true))
      const cupMaterial = makeHueMaterial(baseHue, phase + 0.4, 0.82, 0.07, 0.58)
      const cup = new THREE.Mesh(cupGeometry, cupMaterial)
      cup.position.y = 0.32
      cup.rotation.z = Math.sin(phase) >= 0 ? 0.12 : -0.12
      group.add(cup)

      const lipMaterial = makeHueMaterial(clampHue(baseHue + 0.42), phase + 1.1, 0.96, 0.1, 0.74)
      const lip = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.41, 0.035, 8, 36)), lipMaterial)
      lip.position.y = 0.88
      lip.rotation.x = Math.PI / 2
      group.add(lip)

      livingPlants.push({
        group,
        phase,
        sway: 0.016 + Math.random() * 0.022,
        baseScale: scale,
        distanceFromCenter: Math.abs(position.x) + Math.abs(position.y) * 0.4,
      })

      if (secondary) {
        secondaryDetails.push(group)
      }
    }

    createExoticPlant(new THREE.Vector3(-7.15, -2.85, -0.45), 1.1, 0.34, 0.2, 6)
    createExoticPlant(new THREE.Vector3(-5.7, -2.95, -0.1), 0.78, 0.82, 1.1, 5)
    createExoticPlant(new THREE.Vector3(5.75, -2.92, -0.1), 0.84, 0.52, 2.1, 5)
    createExoticPlant(new THREE.Vector3(7.25, -2.78, -0.4), 1.05, 0.92, 3.0, 6)
    createExoticPlant(new THREE.Vector3(-7.55, 0.08, -0.8), 0.72, 0.48, 4.1, 5, true)
    createExoticPlant(new THREE.Vector3(7.55, 0.4, -0.8), 0.72, 0.12, 5.1, 5, true)

    createOrchidBloom(new THREE.Vector3(-5.85, 2.75, -0.15), 0.84, 0.88, 0.65)
    createOrchidBloom(new THREE.Vector3(5.95, 2.72, -0.2), 0.78, 0.52, 1.8)
    createOrchidBloom(new THREE.Vector3(-4.95, -2.78, 0.06), 0.62, 0.12, 2.8, true)
    createOrchidBloom(new THREE.Vector3(4.9, -2.82, 0.06), 0.64, 0.76, 3.8, true)

    createPitcherPlant(new THREE.Vector3(-7.0, 1.65, -0.35), 0.86, 0.78, 0.45)
    createPitcherPlant(new THREE.Vector3(7.05, -1.1, -0.25), 0.94, 0.04, 2.45)
    createPitcherPlant(new THREE.Vector3(-4.75, 3.02, -0.85), 0.56, 0.42, 4.45, true)
    createPitcherPlant(new THREE.Vector3(4.75, 3.0, -0.85), 0.56, 0.94, 5.45, true)

    const createResonanceBloom = (
      position: THREE.Vector3,
      scale: number,
      baseHue: number,
      phase: number,
    ) => {
      const group = new THREE.Group()
      group.position.copy(position)
      group.scale.setScalar(scale)
      world.add(group)

      const petals: THREE.Group[] = []

      for (let index = 0; index < 9; index += 1) {
        const petalGroup = new THREE.Group()
        petalGroup.rotation.z = (index / 9) * Math.PI * 2
        group.add(petalGroup)
        petals.push(petalGroup)

        const petalMaterial = makeHueMaterial(
          clampHue(baseHue + index * 0.035),
          phase + index * 0.31,
          0.92,
          0.07,
          0.7,
        )
        const petal = new THREE.Mesh(petalGeometry, petalMaterial)
        petal.scale.set(0.82, 1.25, 1)
        petal.position.y = 0.12
        petalGroup.add(petal)
      }

      const centerMaterial = makeHueMaterial(clampHue(baseHue + 0.48), phase + 0.5, 1, 0.12, 0.82)
      const center = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.28, 1)), centerMaterial)
      group.add(center)

      const ringMaterial = makeHueMaterial(clampHue(baseHue + 0.18), phase + 1.2, 0.64, 0.05, 0.58)
      const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.08, 0.018, 8, 80)), ringMaterial)
      ring.rotation.x = 0.35
      group.add(ring)

      resonanceBlooms.push({
        group,
        petals,
        center,
        centerMaterial,
        ring,
        ringMaterial,
        phase,
        baseScale: scale,
      })
    }

    createResonanceBloom(new THREE.Vector3(-7.15, 1.65, -0.18), 1.02, 0.46, 0.8)
    createResonanceBloom(new THREE.Vector3(7.2, -1.35, -0.1), 1.08, 0.88, 3.1)

    const createRootPath = (
      points: THREE.Vector3[],
      hue: number,
      phase: number,
      pulseSpeed: number,
      thickness = 0.055,
      pulseCount = 2,
    ) => {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45)
      const barkGeometry = trackGeometry(new THREE.TubeGeometry(curve, 180, thickness * 2.8, 7, false))
      const sapGeometry = trackGeometry(new THREE.TubeGeometry(curve, 180, thickness, 6, false))

      const barkMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.bark,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        }),
      )
      const sapMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.95, 0.18),
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const bark = new THREE.Mesh(barkGeometry, barkMaterial)
      const sap = new THREE.Mesh(sapGeometry, sapMaterial)
      world.add(bark, sap)
      rootPaths.push({ barkMaterial, sapMaterial, baseHue: hue, phase })

      const coreMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.96, 0.72),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const glowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.94, 0.58),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      for (let index = 0; index < pulseCount; index += 1) {
        const core = new THREE.Mesh(pulseCoreGeometry, coreMaterial)
        const glow = new THREE.Mesh(pulseGlowGeometry, glowMaterial)
        world.add(core, glow)
        rootPulses.push({
          core,
          glow,
          coreMaterial,
          glowMaterial,
          curve,
          offset: (index / pulseCount + phase * 0.07) % 1,
          speed: pulseSpeed,
        })
      }
    }

    createRootPath(
      [
        new THREE.Vector3(-4.05, 1.82, -0.12),
        new THREE.Vector3(-5.25, 2.45, -0.42),
        new THREE.Vector3(-7.4, 3.55, -1.35),
        new THREE.Vector3(-11.6, 5.05, -4.7),
      ],
      0.34,
      0.4,
      0.12,
      0.06,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(4.08, 1.82, -0.12),
        new THREE.Vector3(5.45, 2.55, -0.48),
        new THREE.Vector3(7.65, 3.48, -1.35),
        new THREE.Vector3(11.7, 4.95, -4.8),
      ],
      0.91,
      1.2,
      0.13,
      0.06,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(-4.35, 0.1, -0.1),
        new THREE.Vector3(-6.0, 0.5, -0.5),
        new THREE.Vector3(-8.6, 0.25, -2.0),
        new THREE.Vector3(-12.4, 0.92, -5.2),
      ],
      0.49,
      2.1,
      0.145,
      0.054,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(4.35, -0.18, -0.1),
        new THREE.Vector3(5.95, -0.65, -0.52),
        new THREE.Vector3(8.65, -0.52, -2.1),
        new THREE.Vector3(12.4, -1.0, -5.2),
      ],
      0.04,
      2.8,
      0.15,
      0.054,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(-3.45, -2.32, -0.12),
        new THREE.Vector3(-4.9, -2.8, -0.52),
        new THREE.Vector3(-7.2, -4.0, -1.65),
        new THREE.Vector3(-11.15, -5.6, -5.0),
      ],
      0.78,
      3.5,
      0.13,
      0.058,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(3.45, -2.32, -0.12),
        new THREE.Vector3(4.95, -2.85, -0.52),
        new THREE.Vector3(7.25, -4.08, -1.65),
        new THREE.Vector3(11.2, -5.62, -5.0),
      ],
      0.56,
      4.2,
      0.13,
      0.058,
      3,
    )
    createRootPath(
      [
        new THREE.Vector3(-0.18, 2.5, -0.16),
        new THREE.Vector3(0.18, 3.25, -0.55),
        new THREE.Vector3(-0.3, 4.55, -2.0),
        new THREE.Vector3(0.05, 6.45, -5.3),
      ],
      0.13,
      4.9,
      0.11,
      0.046,
      2,
    )
    createRootPath(
      [
        new THREE.Vector3(0.2, -2.48, -0.16),
        new THREE.Vector3(-0.18, -3.35, -0.6),
        new THREE.Vector3(0.32, -4.62, -2.1),
        new THREE.Vector3(-0.05, -6.2, -5.25),
      ],
      0.72,
      5.6,
      0.11,
      0.046,
      2,
    )

    const mistGeometry = trackGeometry(new THREE.PlaneGeometry(10, 1.6))

    const createMistBand = (
      x: number,
      y: number,
      z: number,
      hue: number,
      phase: number,
      speed: number,
      scaleX: number,
    ) => {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.72, 0.36),
          transparent: true,
          opacity: 0.018,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const mesh = new THREE.Mesh(mistGeometry, material)
      mesh.position.set(x, y, z)
      mesh.scale.x = scaleX
      world.add(mesh)
      mistBands.push({ mesh, material, baseX: x, baseY: y, phase, speed })
    }

    createMistBand(-4.5, -3.3, -1.7, 0.48, 0.4, 0.08, 1.2)
    createMistBand(4.8, -3.5, -2.1, 0.78, 2.1, 0.07, 1.25)
    createMistBand(0, 3.7, -3.1, 0.34, 4.0, 0.045, 1.4)

    const sporeCount = 120
    const sporePositions = new Float32Array(sporeCount * 3)
    const sporeVelocity = new Float32Array(sporeCount)
    const sporePhase = new Float32Array(sporeCount)

    for (let index = 0; index < sporeCount; index += 1) {
      sporePositions[index * 3] = (Math.random() - 0.5) * 20
      sporePositions[index * 3 + 1] = -4.2 + Math.random() * 8.5
      sporePositions[index * 3 + 2] = -5 + Math.random() * 5
      sporeVelocity[index] = 0.05 + Math.random() * 0.12
      sporePhase[index] = Math.random() * Math.PI * 2
    }

    const sporeGeometry = trackGeometry(new THREE.BufferGeometry())
    sporeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sporePositions, 3))

    const sporeMaterial = trackMaterial(
      new THREE.PointsMaterial({
        color: COLORS.pale,
        size: 0.04,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const spores = new THREE.Points(sporeGeometry, sporeMaterial)
    world.add(spores)

    for (let index = 0; index < 5; index += 1) {
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: COLORS.green,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const mesh = new THREE.Mesh(rippleGeometry, material)
      mesh.visible = false
      mesh.position.z = 0.08 + index * 0.01
      world.add(mesh)
      ripples.push({
        mesh,
        material,
        active: false,
        startTime: 0,
        duration: 1.6,
        maxScale: 8,
      })
    }

    const pointerTarget = new THREE.Vector2()
    const pointerCurrent = new THREE.Vector2()
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    window.addEventListener('pointermove', handlePointerMove)

    const applyResponsiveLayout = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      const aspect = width / Math.max(height, 1)

      secondaryDetails.forEach((detail) => {
        detail.visible = width >= 900
      })

      if (width < 640) {
        world.scale.setScalar(0.66)
        world.position.set(0, -0.08, 0)
        camera.fov = 70
      } else if (width < 1000 || aspect < 1.22) {
        world.scale.setScalar(0.82)
        world.position.set(0, 0.02, 0)
        camera.fov = 66
      } else if (width > 1900 && aspect > 1.6) {
        world.scale.setScalar(1.08)
        world.position.set(0, 0.06, 0)
        camera.fov = 56
      } else {
        world.scale.setScalar(1)
        world.position.set(0, 0.06, 0)
        camera.fov = 58
      }

      camera.updateProjectionMatrix()
    }

    applyResponsiveLayout()

    let elapsed = 0
    let previousTimestamp = performance.now()
    let animationFrameId = 0
    let previousSignalId = visualStateRef.current.signalId
    let previousPlaying = visualStateRef.current.isPlaying
    let initialActivationPending = Boolean(previousSignalId)
    let transitionBoost = 0

    const activateRipples = (color: number, strength: number) => {
      ripples.forEach((ripple, index) => {
        ripple.material.color.setHex(index % 2 === 0 ? color : COLORS.violet)
        ripple.active = true
        ripple.startTime = elapsed + index * 0.115
        ripple.duration = THREE.MathUtils.lerp(1.8, 0.95, strength)
        ripple.maxScale = THREE.MathUtils.lerp(7.5, 11.5, strength)
        ripple.mesh.visible = true
        ripple.mesh.scale.setScalar(0.55)
      })
      transitionBoost = Math.max(transitionBoost, strength)
    }

    const animate = (timestamp: number) => {
      animationFrameId = window.requestAnimationFrame(animate)

      const delta = Math.min((timestamp - previousTimestamp) / 1000, 0.05)
      previousTimestamp = timestamp
      const state = visualStateRef.current
      const reduced = state.reducedMotion || mediaQuery.matches
      const hasSignal = Boolean(state.signalId)
      const armed = hasSignal && !state.isPlaying
      const stateEnergy = state.isPlaying ? 1 : armed ? 0.52 : 0.12
      const motionScale = reduced ? 0.13 : state.isPlaying ? 1.62 : armed ? 0.66 : 0.24
      const volumeEnergy = 0.72 + state.volume * 0.28
      elapsed += delta * (reduced ? 0.16 : 1)
      transitionBoost = Math.max(0, transitionBoost - delta * 0.72)

      if (initialActivationPending) {
        if (!reduced) {
          activateRipples(
            state.isPlaying ? COLORS.acid : COLORS.cyan,
            state.isPlaying ? 1 : 0.72,
          )
        }
        initialActivationPending = false
      }

      if (state.signalId !== previousSignalId) {
        if (!reduced) {
          activateRipples(
            state.signalId ? COLORS.cyan : COLORS.violet,
            state.signalId ? 0.76 : 0.42,
          )
        }
        previousSignalId = state.signalId
      }

      if (state.isPlaying !== previousPlaying) {
        if (!reduced) {
          activateRipples(
            state.isPlaying ? COLORS.acid : COLORS.magenta,
            state.isPlaying ? 1 : 0.58,
          )
        }
        previousPlaying = state.isPlaying
      }

      pointerCurrent.lerp(pointerTarget, reduced ? 0.008 : 0.025)
      world.rotation.y = pointerCurrent.x * 0.026
      world.rotation.x = -pointerCurrent.y * 0.018

      hueBindings.forEach((binding) => {
        const colorWave = Math.sin(
          elapsed * (state.isPlaying ? 0.8 : armed ? 0.22 : 0.06) +
            binding.phase +
            transitionBoost * 1.8,
        )
        const hueTravel = state.isPlaying ? elapsed * 0.018 : armed ? elapsed * 0.004 : elapsed * 0.001
        const hue = clampHue(binding.baseHue + hueTravel + colorWave * (state.isPlaying ? 0.065 : 0.018))
        const lightness =
          THREE.MathUtils.lerp(binding.dormantLightness, binding.activeLightness, stateEnergy * volumeEnergy) +
          Math.max(0, colorWave) * (state.isPlaying ? 0.055 : 0.012) +
          transitionBoost * 0.07
        binding.material.color.setHSL(hue, binding.saturation, Math.min(lightness, 0.78))
        binding.material.opacity = Math.min(
          1,
          binding.opacity * (0.42 + stateEnergy * 0.68 + transitionBoost * 0.18),
        )
      })

      canopyLeaves.forEach(({ mesh, material, phase, baseRotation, baseHue }, index) => {
        const sway = Math.sin(elapsed * (0.1 + motionScale * 0.12) + phase) * (0.018 + stateEnergy * 0.03)
        mesh.rotation.z = baseRotation.z + sway
        mesh.rotation.x = baseRotation.x + Math.cos(elapsed * 0.09 + phase) * 0.018
        const canopyWave = (Math.sin(elapsed * (state.isPlaying ? 1.1 : 0.22) + phase + index * 0.23) + 1) * 0.5
        material.color.setHSL(
          clampHue(baseHue + (state.isPlaying ? canopyWave * 0.065 : 0)),
          0.76,
          0.055 + stateEnergy * 0.11 + canopyWave * stateEnergy * 0.045,
        )
        material.opacity = 0.48 + stateEnergy * 0.24
      })

      livingPlants.forEach(
        ({ group, phase, sway, baseScale, bloom, bloomBaseScale, distanceFromCenter }, index) => {
          const breathe = Math.sin(elapsed * (0.32 + motionScale * 0.2) + phase)
          const wakeWave = Math.max(
            0,
            Math.sin(
              elapsed * (state.isPlaying ? 1.5 : 0.45) -
                distanceFromCenter * 0.22 +
                phase,
            ),
          )
          group.rotation.z = breathe * sway * (0.55 + stateEnergy * 1.2)
          group.rotation.y = Math.sin(elapsed * 0.18 + phase) * 0.035
          const plantScale =
            1 + breathe * (0.008 + stateEnergy * 0.024) + transitionBoost * 0.018
          group.scale.setScalar(baseScale * plantScale)

          if (bloom && bloomBaseScale !== undefined) {
            const openAmount = armed ? 0.82 : state.isPlaying ? 1.16 : 0.58
            bloom.scale.setScalar(
              bloomBaseScale * (openAmount + wakeWave * stateEnergy * 0.12),
            )
            bloom.rotation.z +=
              delta * motionScale * (index % 2 === 0 ? 0.06 : -0.06)
          }
        },
      )

      resonanceBlooms.forEach(({ group, petals, center, centerMaterial, ring, ringMaterial, phase, baseScale }) => {
        const pulse = (Math.sin(elapsed * (state.isPlaying ? 2.1 : armed ? 0.75 : 0.24) + phase) + 1) * 0.5
        const open = state.isPlaying ? 1.18 : armed ? 0.86 : 0.56

        petals.forEach((petal, index) => {
          petal.rotation.x = THREE.MathUtils.lerp(0.74, 0.04, open) + Math.sin(elapsed * 0.35 + phase + index) * 0.025
          petal.rotation.z = (index / petals.length) * Math.PI * 2
        })

        group.scale.setScalar(baseScale * (0.96 + pulse * (0.025 + stateEnergy * 0.06)))
        group.rotation.z = Math.sin(elapsed * 0.14 + phase) * 0.035
        center.rotation.x += delta * motionScale * 0.24
        center.rotation.y -= delta * motionScale * 0.31
        ring.rotation.z += delta * motionScale * 0.18
        centerMaterial.opacity = 0.35 + stateEnergy * 0.65
        ringMaterial.opacity = 0.18 + stateEnergy * 0.5
      })

      rootPaths.forEach(({ barkMaterial, sapMaterial, baseHue, phase }) => {
        const pulse = (Math.sin(elapsed * (state.isPlaying ? 2.4 : armed ? 0.72 : 0.18) + phase) + 1) * 0.5
        barkMaterial.opacity = 0.56 + stateEnergy * 0.22
        sapMaterial.color.setHSL(
          clampHue(baseHue + (state.isPlaying ? pulse * 0.055 : 0)),
          0.96,
          0.16 + stateEnergy * 0.48 + pulse * stateEnergy * 0.08,
        )
        sapMaterial.opacity = 0.025 + stateEnergy * 0.72 * volumeEnergy + transitionBoost * 0.13
      })

      rootPulses.forEach(({ core, glow, coreMaterial, glowMaterial, curve, offset, speed }) => {
        const effectiveSpeed = speed * (state.isPlaying ? 3.3 : armed ? 1.05 : 0.18)
        const progress = (elapsed * effectiveSpeed + offset) % 1
        const point = curve.getPointAt(progress)
        core.position.copy(point)
        glow.position.copy(point)

        const pulse = Math.sin(progress * Math.PI)
        core.scale.setScalar(0.72 + pulse * (state.isPlaying ? 0.8 : 0.25))
        glow.scale.setScalar(0.72 + pulse * (state.isPlaying ? 1.6 : armed ? 0.65 : 0.25))
        coreMaterial.opacity = state.isPlaying ? 0.95 : armed ? 0.58 : 0.12
        glowMaterial.opacity = (state.isPlaying ? 0.34 : armed ? 0.13 : 0.025) * volumeEnergy
      })

      mistBands.forEach(({ mesh, material, baseX, baseY, phase, speed }, index) => {
        mesh.position.x = baseX + Math.sin(elapsed * speed + phase) * 1.1
        mesh.position.y = baseY + Math.cos(elapsed * speed * 0.7 + phase) * 0.1
        mesh.rotation.z = Math.sin(elapsed * speed * 0.55 + phase) * 0.04
        material.opacity = 0.012 + stateEnergy * (index === 2 ? 0.016 : 0.026)
      })

      const sporePositionAttribute = sporeGeometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < sporeCount; index += 1) {
        const yIndex = index * 3 + 1
        const xIndex = index * 3
        sporePositions[yIndex] += sporeVelocity[index] * delta * (0.3 + stateEnergy * 2.4)
        sporePositions[xIndex] += Math.sin(elapsed * 0.3 + sporePhase[index]) * delta * 0.015

        if (sporePositions[yIndex] > 5.1) {
          sporePositions[yIndex] = -4.2
          sporePositions[xIndex] = (Math.random() - 0.5) * 20
        }
      }
      sporePositionAttribute.needsUpdate = true
      sporeMaterial.opacity = 0.025 + stateEnergy * 0.12
      sporeMaterial.size = 0.028 + stateEnergy * 0.035

      ripples.forEach((ripple) => {
        if (reduced) {
          ripple.active = false
          ripple.mesh.visible = false
          ripple.material.opacity = 0
          return
        }

        if (!ripple.active || elapsed < ripple.startTime) {
          return
        }

        const progress = (elapsed - ripple.startTime) / ripple.duration
        if (progress >= 1) {
          ripple.active = false
          ripple.mesh.visible = false
          ripple.material.opacity = 0
          return
        }

        const eased = 1 - Math.pow(1 - progress, 3)
        ripple.mesh.visible = true
        ripple.mesh.scale.setScalar(0.55 + eased * ripple.maxScale)
        ripple.material.opacity = Math.sin(progress * Math.PI) * (state.isPlaying ? 0.38 : 0.25)
        ripple.mesh.rotation.z = progress * 0.18
      })

      renderer.render(scene, camera)
    }

    animationFrameId = window.requestAnimationFrame(animate)

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

  return <div ref={mountRef} className="mycelium-temple-scene" aria-hidden="true" />
}

export default MyceliumTempleTheme
