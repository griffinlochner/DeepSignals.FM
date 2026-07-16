import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThemeSceneProps } from '../themeTypes'
import './cosmicNexus.css'

type AnimatedRing = {
  mesh: THREE.Mesh
  rotationSpeed: THREE.Vector3
}

type SignalPulse = {
  pulse: THREE.Mesh
  glow: THREE.Mesh
  curve: THREE.Curve<THREE.Vector3>
  speed: number
  offset: number
}

type SignalBeacon = {
  glow: THREE.Mesh
  offset: number
}

type SignalStreak = {
  line: THREE.Line
  speed: number
}

function CosmicNexusTheme({ reducedMotion }: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x010104)
    scene.fog = new THREE.FogExp2(0x010104, 0.035)

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100)

    camera.position.set(0, 0, 8.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })

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

    const neonGreen = 0x39ff14
    const neonPink = 0xff4d7a
    const neonOrange = 0xff7a00
    const neonPurple = 0x8b35ff
    const icyBlue = 0x79fff2

    const signalSystem = new THREE.Group()
    scene.add(signalSystem)

    const createStarLayer = (count: number, spread: number, size: number, color: number, opacity: number, minimumZ: number, maximumZ: number) => {
      const positions = new Float32Array(count * 3)

      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * spread
        positions[index * 3 + 1] = (Math.random() - 0.5) * spread * 0.7
        positions[index * 3 + 2] = minimumZ + Math.random() * (maximumZ - minimumZ)
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

      const stars = new THREE.Points(geometry, material)
      scene.add(stars)

      return stars
    }

    const distantStars = createStarLayer(2200, 70, 0.025, 0xffffff, 0.7, -38, -5)
    const coloredStars = createStarLayer(500, 55, 0.045, 0xa87cff, 0.55, -28, 1)
    const brightStars = createStarLayer(130, 45, 0.075, 0xd9fffb, 0.8, -20, 2)

    const streakGeometry = trackGeometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.18, 0.06, 1.5)]))

    const streakMaterial = trackMaterial(
      new THREE.LineBasicMaterial({
        color: icyBlue,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )

    const signalStreaks: SignalStreak[] = []

    for (let index = 0; index < 12; index += 1) {
      const line = new THREE.Line(streakGeometry, streakMaterial)
      line.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, -30 + Math.random() * 30)
      line.scale.setScalar(0.5 + Math.random() * 1.6)
      scene.add(line)

      signalStreaks.push({ line, speed: 5 + Math.random() * 9 })
    }

    const receiverPosition = new THREE.Vector3(2.7, -1.25, 0)
    const receiver = new THREE.Group()
    receiver.position.copy(receiverPosition)
    signalSystem.add(receiver)

    const coreGeometry = trackGeometry(new THREE.SphereGeometry(0.58, 48, 32))
    const coreMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x070311 }))
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    receiver.add(core)

    const coreGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.88, 36, 24))
    const coreGlowMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: neonPurple,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const coreGlow = new THREE.Mesh(coreGlowGeometry, coreGlowMaterial)
    receiver.add(coreGlow)

    const shellGeometry = trackGeometry(new THREE.IcosahedronGeometry(0.72, 2))
    const shellMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: neonPurple,
        wireframe: true,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const shell = new THREE.Mesh(shellGeometry, shellMaterial)
    receiver.add(shell)

    const innerCoreGeometry = trackGeometry(new THREE.SphereGeometry(0.16, 24, 18))
    const innerCoreMaterial = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: neonPink,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const innerCore = new THREE.Mesh(innerCoreGeometry, innerCoreMaterial)
    receiver.add(innerCore)

    const animatedRings: AnimatedRing[] = []

    const createOrbitalRing = (radius: number, tubeRadius: number, color: number, rotation: THREE.Euler, rotationSpeed: THREE.Vector3) => {
      const geometry = trackGeometry(new THREE.TorusGeometry(radius, tubeRadius, 12, 110))
      const material = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const ring = new THREE.Mesh(geometry, material)
      ring.rotation.copy(rotation)
      receiver.add(ring)

      const nodeGeometry = trackGeometry(new THREE.SphereGeometry(0.045, 12, 10))
      const nodeMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial)
      node.position.x = radius
      ring.add(node)

      animatedRings.push({ mesh: ring, rotationSpeed })
    }

    createOrbitalRing(1.02, 0.018, neonGreen, new THREE.Euler(0.3, 0.5, 0.1), new THREE.Vector3(0.08, 0.15, 0.05))
    createOrbitalRing(1.34, 0.022, neonPink, new THREE.Euler(1.05, 0.15, 0.65), new THREE.Vector3(-0.11, 0.06, 0.13))
    createOrbitalRing(1.64, 0.015, neonOrange, new THREE.Euler(0.5, 1.1, -0.45), new THREE.Vector3(0.05, -0.09, 0.08))

    const createHelixCurve = (start: THREE.Vector3, end: THREE.Vector3, turns: number, radius: number) => {
      const forward = end.clone().sub(start).normalize()
      const reference = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      const side = new THREE.Vector3().crossVectors(forward, reference).normalize()
      const up = new THREE.Vector3().crossVectors(side, forward).normalize()

      const points: THREE.Vector3[] = []
      const pointCount = 110

      for (let index = 0; index <= pointCount; index += 1) {
        const progress = index / pointCount
        const point = start.clone().lerp(end, progress)
        const phase = progress * Math.PI * 2 * turns
        const taperedRadius = THREE.MathUtils.lerp(radius, 0.025, progress)
        point.addScaledVector(side, Math.cos(phase) * taperedRadius)
        point.addScaledVector(up, Math.sin(phase) * taperedRadius)
        points.push(point)
      }

      return new THREE.CatmullRomCurve3(points)
    }

    const createArcCurve = (start: THREE.Vector3, controlOne: THREE.Vector3, controlTwo: THREE.Vector3, end: THREE.Vector3) =>
      new THREE.CatmullRomCurve3([start, controlOne, controlTwo, end], false, 'catmullrom', 0.5)

    const pulseGeometry = trackGeometry(new THREE.SphereGeometry(0.055, 14, 12))
    const pulseGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.14, 14, 12))
    const beaconGeometry = trackGeometry(new THREE.SphereGeometry(0.045, 14, 12))
    const beaconGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.16, 14, 12))

    const signalPulses: SignalPulse[] = []
    const signalBeacons: SignalBeacon[] = []

    const createSignal = (curve: THREE.Curve<THREE.Vector3>, color: number, speed: number, startingOffset: number) => {
      const outerGeometry = trackGeometry(new THREE.TubeGeometry(curve, 180, 0.035, 6, false))
      const innerGeometry = trackGeometry(new THREE.TubeGeometry(curve, 180, 0.011, 5, false))

      const outerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const innerMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const outerSignal = new THREE.Mesh(outerGeometry, outerMaterial)
      const innerSignal = new THREE.Mesh(innerGeometry, innerMaterial)
      signalSystem.add(outerSignal)
      signalSystem.add(innerSignal)

      const beaconMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const beaconGlowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      const sourcePoint = curve.getPointAt(0)
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial)
      beacon.position.copy(sourcePoint)
      const beaconGlow = new THREE.Mesh(beaconGlowGeometry, beaconGlowMaterial)
      beaconGlow.position.copy(sourcePoint)
      signalSystem.add(beacon)
      signalSystem.add(beaconGlow)

      signalBeacons.push({ glow: beaconGlow, offset: startingOffset })

      const pulseMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const pulseGlowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )

      ;[startingOffset, startingOffset + 0.5].forEach((offset) => {
        const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial)
        const glow = new THREE.Mesh(pulseGlowGeometry, pulseGlowMaterial)
        signalSystem.add(pulse)
        signalSystem.add(glow)

        signalPulses.push({ pulse, glow, curve, speed, offset })
      })
    }

    createSignal(createHelixCurve(new THREE.Vector3(-5.8, 2.7, -2.5), receiverPosition, 7, 0.33), neonGreen, 0.17, 0.1)
    createSignal(createHelixCurve(new THREE.Vector3(-4.7, -2.8, -1.5), receiverPosition, 5, 0.24), neonPink, 0.21, 0.42)
    createSignal(createArcCurve(new THREE.Vector3(-0.8, 4.2, -4.5), new THREE.Vector3(-1.8, 2.9, -2.5), new THREE.Vector3(1.2, 1.6, -0.8), receiverPosition), neonOrange, 0.14, 0.7)
    createSignal(createArcCurve(new THREE.Vector3(-6.2, 0.1, -6), new THREE.Vector3(-3.8, -0.8, -3), new THREE.Vector3(0.4, -2, -1), receiverPosition), icyBlue, 0.19, 0.25)

    const applyResponsiveLayout = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      const aspect = width / height

      if (width < 760) {
        signalSystem.scale.setScalar(0.68)
        signalSystem.position.set(0.45, -0.8, 0)
        camera.fov = 67
      } else if (aspect < 1.3) {
        signalSystem.scale.setScalar(0.84)
        signalSystem.position.set(0.35, -0.25, 0)
        camera.fov = 64
      } else {
        signalSystem.scale.setScalar(1)
        signalSystem.position.set(0, 0, 0)
        camera.fov = 60
      }

      camera.updateProjectionMatrix()
    }

    applyResponsiveLayout()

    const pointerTarget = new THREE.Vector2()
    const pointerCurrent = new THREE.Vector2()

    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    window.addEventListener('pointermove', handlePointerMove)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motionMultiplier = reducedMotion || prefersReducedMotion ? 0.18 : 1

    const timer = new THREE.Timer()
    timer.connect(document)

    let elapsedTime = 0
    let animationFrameId = 0

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()
      const delta = Math.min(timer.getDelta(), 0.05)
      elapsedTime += delta * motionMultiplier

      pointerCurrent.lerp(pointerTarget, 0.025)
      signalSystem.rotation.y = pointerCurrent.x * 0.035
      signalSystem.rotation.x = -pointerCurrent.y * 0.025

      animatedRings.forEach(({ mesh, rotationSpeed }) => {
        mesh.rotation.x += rotationSpeed.x * delta * motionMultiplier
        mesh.rotation.y += rotationSpeed.y * delta * motionMultiplier
        mesh.rotation.z += rotationSpeed.z * delta * motionMultiplier
      })

      shell.rotation.x += 0.05 * delta * motionMultiplier
      shell.rotation.y -= 0.08 * delta * motionMultiplier

      const corePulse = 1 + Math.sin(elapsedTime * 1.8) * 0.055
      coreGlow.scale.setScalar(corePulse)
      coreGlowMaterial.opacity = 0.075 + (Math.sin(elapsedTime * 1.8) + 1) * 0.025
      innerCore.scale.setScalar(1 + Math.sin(elapsedTime * 2.7) * 0.1)

      signalPulses.forEach(({ pulse, glow, curve, speed, offset }) => {
        const progress = (elapsedTime * speed + offset) % 1
        const point = curve.getPointAt(progress)
        pulse.position.copy(point)
        glow.position.copy(point)

        const pulseScale = 0.85 + Math.sin(progress * Math.PI * 2) * 0.2
        pulse.scale.setScalar(pulseScale)
        glow.scale.setScalar(pulseScale * 1.1)
      })

      signalBeacons.forEach(({ glow, offset }) => {
        const scale = 0.85 + (Math.sin(elapsedTime * 1.5 + offset * Math.PI * 2) + 1) * 0.2
        glow.scale.setScalar(scale)
      })

      distantStars.rotation.y += 0.002 * delta * motionMultiplier
      coloredStars.rotation.z -= 0.003 * delta * motionMultiplier
      brightStars.rotation.x += 0.0015 * delta * motionMultiplier
      brightStars.rotation.y -= 0.004 * delta * motionMultiplier

      signalStreaks.forEach(({ line, speed }) => {
        line.position.z += speed * delta * motionMultiplier
        line.position.x -= speed * 0.012 * delta * motionMultiplier

        if (line.position.z > 7) {
          line.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, -30 - Math.random() * 12)
        }
      })

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / height
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      applyResponsiveLayout()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      timer.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.cancelAnimationFrame(animationFrameId)
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      scene.clear()
      renderer.dispose()

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="signal-scene" aria-hidden="true" />
}

export default CosmicNexusTheme
