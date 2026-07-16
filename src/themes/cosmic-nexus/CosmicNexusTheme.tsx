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
  curve: THREE.Curve<THREE.Vector3>
  speed: number
  offset: number
}

type Relay = {
  group: THREE.Group
  shell: THREE.Mesh
  glow: THREE.Mesh
  glowMaterial: THREE.MeshBasicMaterial
  phase: number
}

type FloatingGlyph = {
  mesh: THREE.LineLoop
  basePosition: THREE.Vector3
  phase: number
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
  visualStateRef.current = props

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x010104)
    scene.fog = new THREE.FogExp2(0x010104, 0.028)

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 120)
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
    const floatingGlyphs: FloatingGlyph[] = []

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

    const outerAperture = createApertureOutline(7.9, 4.65, COLORS.cyan, 0.18, -0.04)
    const middleAperture = createApertureOutline(7.55, 4.3, COLORS.violet, 0.24, 0)
    const innerAperture = createApertureOutline(7.25, 4.02, COLORS.green, 0.22, 0.04)

    const haloGeometry = trackGeometry(new THREE.PlaneGeometry(8.7, 5.25))
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
        { radius: 0.72, tube: 0.014, tilt: new THREE.Euler(0.5, 0.2, 0.15), speed: new THREE.Vector3(0.05, 0.11, 0.04) },
        { radius: 0.93, tube: 0.012, tilt: new THREE.Euler(1.1, 0.35, 0.7), speed: new THREE.Vector3(-0.08, 0.04, 0.09) },
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

      relays.push({ group, shell, glow, glowMaterial, phase })
      return group
    }

    const upperLeftRelay = createRelay(new THREE.Vector3(-5.45, 2.55, -0.35), 0.82, COLORS.green, 0.2)
    const upperRightRelay = createRelay(new THREE.Vector3(5.2, 2.2, -0.65), 0.62, COLORS.orange, 1.7)
    const lowerRightRelay = createRelay(new THREE.Vector3(5.35, -2.45, -0.15), 1.08, COLORS.violet, 3.1)
    const lowerLeftRelay = createRelay(new THREE.Vector3(-5.25, -2.55, -0.75), 0.55, COLORS.pink, 4.5)

    const createCurve = (start: THREE.Vector3, controls: THREE.Vector3[], end: THREE.Vector3) =>
      new THREE.CatmullRomCurve3([start, ...controls, end], false, 'catmullrom', 0.45)

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
          opacity: 0.58,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      world.add(new THREE.Mesh(outerGeometry, outerMaterial))
      world.add(new THREE.Mesh(innerGeometry, innerMaterial))

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
        pulses.push({ core, glow, curve, speed, offset: pulseOffset })
      })
    }

    const anchorUpperLeft = new THREE.Vector3(-3.62, 1.8, 0)
    const anchorUpperRight = new THREE.Vector3(3.62, 1.8, 0)
    const anchorLowerRight = new THREE.Vector3(3.62, -1.78, 0)
    const anchorLowerLeft = new THREE.Vector3(-3.62, -1.78, 0)

    createSignalPath(
      createCurve(upperLeftRelay.position.clone(), [new THREE.Vector3(-4.8, 3.1, -0.2), new THREE.Vector3(-4.1, 2.35, 0)], anchorUpperLeft),
      COLORS.green,
      0.17,
      0.08,
    )
    createSignalPath(
      createCurve(upperRightRelay.position.clone(), [new THREE.Vector3(4.6, 2.95, -0.5), new THREE.Vector3(4.05, 2.2, 0)], anchorUpperRight),
      COLORS.orange,
      0.13,
      0.36,
    )
    createSignalPath(
      createCurve(lowerRightRelay.position.clone(), [new THREE.Vector3(4.7, -3.15, -0.1), new THREE.Vector3(4.05, -2.2, 0)], anchorLowerRight),
      COLORS.violet,
      0.19,
      0.6,
      0.014,
    )
    createSignalPath(
      createCurve(lowerLeftRelay.position.clone(), [new THREE.Vector3(-4.6, -3.05, -0.65), new THREE.Vector3(-4.0, -2.18, 0)], anchorLowerLeft),
      COLORS.pink,
      0.21,
      0.82,
    )
    createSignalPath(
      createCurve(new THREE.Vector3(-7.2, 0.2, -4), [new THREE.Vector3(-5.8, -0.65, -2), new THREE.Vector3(-4.45, -1.2, -0.7)], new THREE.Vector3(-3.62, -0.65, 0)),
      COLORS.cyan,
      0.15,
      0.25,
      0.01,
    )

    const glyphGeometry = trackGeometry(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.16, -0.16, 0),
        new THREE.Vector3(0.16, -0.16, 0),
        new THREE.Vector3(0.16, 0.16, 0),
        new THREE.Vector3(-0.16, 0.16, 0),
      ]),
    )

    const glyphColors = [COLORS.cyan, COLORS.green, COLORS.pink, COLORS.orange, COLORS.violet]
    for (let index = 0; index < 16; index += 1) {
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
        side * (4.2 + Math.random() * 2.4),
        (Math.random() - 0.5) * 5.6,
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
        world.scale.setScalar(0.64)
        world.position.set(0, -0.2, 0)
        camera.fov = 67
      } else if (width < 1000 || aspect < 1.25) {
        world.scale.setScalar(0.82)
        world.position.set(0, -0.1, 0)
        camera.fov = 63
      } else {
        world.scale.setScalar(1)
        world.position.set(0, 0, 0)
        camera.fov = 58
      }

      camera.updateProjectionMatrix()
    }

    applyResponsiveLayout()

    const timer = new THREE.Timer()
    timer.connect(document)

    let elapsed = 0
    let animationFrameId = 0

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()

      const state = visualStateRef.current
      const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const reduced = state.reducedMotion || systemReducedMotion
      const motionScale = reduced ? 0.16 : 1
      const activeScale = state.isPlaying ? 1.45 : state.signalId ? 0.82 : 0.48
      const volumeScale = 0.72 + state.volume * 0.28
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
        material.opacity = baseOpacity * (0.7 + activeScale * 0.22)
      })

      relays.forEach(({ group, shell, glow, glowMaterial, phase }) => {
        shell.rotation.x += 0.04 * delta * motionScale * activeScale
        shell.rotation.y -= 0.07 * delta * motionScale * activeScale
        const pulse = 1 + Math.sin(elapsed * (1.1 + activeScale * 0.55) + phase) * (state.isPlaying ? 0.1 : 0.045)
        glow.scale.setScalar(pulse)
        glowMaterial.opacity = (state.isPlaying ? 0.13 : state.signalId ? 0.085 : 0.055) * volumeScale
        group.rotation.z = Math.sin(elapsed * 0.18 + phase) * 0.035
      })

      pulses.forEach(({ core, glow, curve, speed, offset }) => {
        const effectiveSpeed = speed * (state.isPlaying ? 1.6 : state.signalId ? 0.8 : 0.3)
        const progress = (elapsed * effectiveSpeed + offset) % 1
        const point = curve.getPointAt(progress)
        core.position.copy(point)
        glow.position.copy(point)
        const scale = 0.82 + Math.sin(progress * Math.PI * 2) * 0.18
        core.scale.setScalar(scale)
        glow.scale.setScalar(scale * (state.isPlaying ? 1.35 : 0.92))
      })

      const aperturePulse = (Math.sin(elapsed * (state.isPlaying ? 2.1 : 0.8)) + 1) * 0.5
      outerAperture.material.opacity = 0.12 + aperturePulse * (state.isPlaying ? 0.18 : 0.06)
      middleAperture.material.opacity = 0.16 + aperturePulse * (state.isPlaying ? 0.2 : 0.07)
      innerAperture.material.opacity = 0.16 + aperturePulse * (state.isPlaying ? 0.24 : 0.06)
      haloMaterial.opacity = state.isPlaying ? 0.06 + aperturePulse * 0.035 : 0.025

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
      renderer.dispose()

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="cosmic-nexus-scene" aria-hidden="true" />
}

export default CosmicNexusTheme
