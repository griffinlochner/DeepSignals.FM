import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ThemeSceneProps } from '../themeTypes'
import './uvReactiveJungle.css'

type DepthImageBreathingPreset = {
  minimumDepth: number
  maximumDepth: number
  cycleDurationSeconds: number
}

type DepthImageThemeProfile = {
  colorImageUrl: string
  depthMapUrl: string
  breathing: DepthImageBreathingPreset
  staticDepth: number
  pointerParallaxStrength: number
  displacementScaleMultiplier: number
}

const UV_JUNGLE_PROFILE: DepthImageThemeProfile = {
  colorImageUrl: '/experiments/depth-lab/jungle-color.png',
  depthMapUrl: '/experiments/depth-lab/jungle-depth.png',
  breathing: {
    minimumDepth: 0,
    maximumDepth: 1,
    cycleDurationSeconds: 4.9,
  },
  staticDepth: 0.42,
  pointerParallaxStrength: 0.085,
  displacementScaleMultiplier: 0.36,
}

const TELEMETRY_UPDATE_INTERVAL_SECONDS = 0.14

function UvReactiveJungleTheme({
  isPlaying,
  reducedMotion,
  motionEnabled = true,
  onDepthResonanceChange,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const visualStateRef = useRef({ isPlaying, reducedMotion, motionEnabled })

  useEffect(() => {
    visualStateRef.current = { isPlaying, reducedMotion, motionEnabled }
  }, [isPlaying, motionEnabled, reducedMotion])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    let animationFrameId = 0
    let disposed = false
    let colorTexture: THREE.Texture | null = null
    let depthTexture: THREE.Texture | null = null
    let lastTelemetrySentAt = -100

    const pointer = new THREE.Vector2(0, 0)
    const pointerTarget = new THREE.Vector2(0, 0)
    const planeScale = new THREE.Vector2(1, 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x08110d)
    scene.fog = new THREE.FogExp2(0x08110d, 0.045)

    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 50)
    camera.position.z = 3.15
    scene.add(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    mount.appendChild(renderer.domElement)

    const planeGroup = new THREE.Group()
    scene.add(planeGroup)

    const ambientLight = new THREE.AmbientLight(0xf2ffe7, 1.85)
    const keyLight = new THREE.DirectionalLight(0xf8f6d2, 1.3)
    keyLight.position.set(-2, 2, 3)
    const rimLight = new THREE.DirectionalLight(0x77ffd9, 0.6)
    rimLight.position.set(2, -1, 2)
    scene.add(ambientLight, keyLight, rimLight)

    const planeGeometry = new THREE.PlaneGeometry(1, 1, 320, 224)
    const planeMaterial = new THREE.MeshStandardMaterial({
      displacementScale: UV_JUNGLE_PROFILE.staticDepth * UV_JUNGLE_PROFILE.displacementScaleMultiplier,
      roughness: 1,
      metalness: 0,
    })

    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.position.z = -0.16
    planeGroup.add(plane)

    const glowGeometry = new THREE.PlaneGeometry(1, 1)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x63ffe6,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    })
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial)
    glowPlane.position.z = -0.95
    planeGroup.add(glowPlane)

    const loadingManager = new THREE.LoadingManager()
    const textureLoader = new THREE.TextureLoader(loadingManager)

    textureLoader.load(UV_JUNGLE_PROFILE.colorImageUrl, (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }

      colorTexture = texture
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      planeMaterial.map = texture
      planeMaterial.needsUpdate = true
    })

    textureLoader.load(UV_JUNGLE_PROFILE.depthMapUrl, (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }

      depthTexture = texture
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      planeMaterial.displacementMap = texture
      planeMaterial.needsUpdate = true
    })

    const fitPlane = () => {
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      const viewHeight =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.abs(camera.position.z - plane.position.z)
      const viewWidth = viewHeight * aspect
      planeScale.set(viewWidth * 1.18, viewHeight * 1.28)
      plane.scale.set(planeScale.x, planeScale.y, 1)
      glowPlane.scale.set(planeScale.x * 1.12, planeScale.y * 1.08, 1)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0)
    }

    const handleResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      fitPlane()
    }

    const timer = new THREE.Timer()
    timer.connect(document)

    let playbackVisualMix = 0

    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('resize', handleResize)
    fitPlane()

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()

      const elapsed = timer.getElapsed()
      const state = visualStateRef.current

      const playing = state.isPlaying
      const pointerMotionAllowed = playing && state.motionEnabled
      const breathingAllowed = playing && state.motionEnabled && !state.reducedMotion
      const colorTarget = playing ? 1 : 0

      const breathingFrequency = (Math.PI * 2) / UV_JUNGLE_PROFILE.breathing.cycleDurationSeconds
      const breathProgress = breathingAllowed ? (Math.sin(elapsed * breathingFrequency) + 1) / 2 : 0
      const effectiveDepth = breathingAllowed
        ? THREE.MathUtils.lerp(
            UV_JUNGLE_PROFILE.breathing.minimumDepth,
            UV_JUNGLE_PROFILE.breathing.maximumDepth,
            breathProgress,
          )
        : UV_JUNGLE_PROFILE.staticDepth

      if (state.reducedMotion) {
        playbackVisualMix = colorTarget
      } else {
        playbackVisualMix = THREE.MathUtils.lerp(playbackVisualMix, colorTarget, 0.055)
      }

      const grayscale = 1 - playbackVisualMix
      const saturation = playbackVisualMix
      const brightness = 0.85 + playbackVisualMix * 0.15
      renderer.domElement.style.filter = `grayscale(${grayscale.toFixed(3)}) saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)})`

      planeMaterial.displacementScale = effectiveDepth * UV_JUNGLE_PROFILE.displacementScaleMultiplier
      planeMaterial.bumpScale = effectiveDepth * 0.04

      if (elapsed - lastTelemetrySentAt >= TELEMETRY_UPDATE_INTERVAL_SECONDS) {
        lastTelemetrySentAt = elapsed
        onDepthResonanceChange?.(effectiveDepth)
      }

      pointer.lerp(pointerTarget, 0.06)
      const parallaxFactor = pointerMotionAllowed ? UV_JUNGLE_PROFILE.pointerParallaxStrength : 0

      planeGroup.position.x = pointer.x * parallaxFactor
      planeGroup.position.y = -pointer.y * parallaxFactor * 0.75
      planeGroup.rotation.y = pointer.x * parallaxFactor * 0.75
      planeGroup.rotation.x = -pointer.y * parallaxFactor * 0.58

      camera.position.x = pointer.x * parallaxFactor * 0.34
      camera.position.y = -pointer.y * parallaxFactor * 0.24
      camera.lookAt(0, 0, -0.42)

      glowMaterial.opacity = 0.045 + effectiveDepth * 0.06

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrameId)
      timer.disconnect()
      onDepthResonanceChange?.(0)
      renderer.domElement.style.filter = ''

      mount.removeEventListener('pointermove', handlePointerMove)
      mount.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('resize', handleResize)

      colorTexture?.dispose()
      depthTexture?.dispose()
      planeGeometry.dispose()
      planeMaterial.dispose()
      glowGeometry.dispose()
      glowMaterial.dispose()
      scene.clear()
      renderer.renderLists.dispose()
      renderer.dispose()

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [onDepthResonanceChange])

  return <div ref={mountRef} className="uv-reactive-jungle-scene" />
}

export default UvReactiveJungleTheme
