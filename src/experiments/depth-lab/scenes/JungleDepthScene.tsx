import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { DepthLabSceneProps, DepthLabPlaybackState } from '../types'

const JUNGLE_IMAGE_PATH = '/experiments/depth-lab/jungle-color.png'
const JUNGLE_DEPTH_MAP_PATH = '/experiments/depth-lab/jungle-depth.png'

const POINTER_IDLE_TIMEOUT_SECONDS = 1.25

const STATE_MOTION: Record<
  DepthLabPlaybackState,
  { motion: number; depth: number; breathAmplitude: number; breathSpeed: number; driftAmount: number; driftSpeed: number }
> = {
  dormant: { motion: 0.08, depth: 0.42, breathAmplitude: 0.018, breathSpeed: 0.32, driftAmount: 0.1, driftSpeed: 0.2 },
  armed: { motion: 0.24, depth: 0.7, breathAmplitude: 0.05, breathSpeed: 0.52, driftAmount: 0.34, driftSpeed: 0.36 },
  playing: { motion: 0.42, depth: 1, breathAmplitude: 0.085, breathSpeed: 0.76, driftAmount: 0.6, driftSpeed: 0.58 },
}

function JungleDepthScene({
  playbackState,
  motionIntensity,
  depthStrength,
  pointerParallaxEnabled,
  autoMotionEnabled,
  onLoadingStateChange,
}: DepthLabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const configRef = useRef({
    playbackState,
    motionIntensity,
    depthStrength,
    pointerParallaxEnabled,
    autoMotionEnabled,
  })

  useEffect(() => {
    configRef.current = {
      playbackState,
      motionIntensity,
      depthStrength,
      pointerParallaxEnabled,
      autoMotionEnabled,
    }
  }, [autoMotionEnabled, depthStrength, motionIntensity, playbackState, pointerParallaxEnabled])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    onLoadingStateChange?.('loading')

    let animationFrameId = 0
    let disposed = false
    let colorTexture: THREE.Texture | null = null
    let depthTexture: THREE.Texture | null = null

    const pointer = new THREE.Vector2(0, 0)
    const pointerTarget = new THREE.Vector2(0, 0)
    const blendedPointer = new THREE.Vector2(0, 0)
    const autonomousPointer = new THREE.Vector2(0, 0)
    const planeScale = new THREE.Vector2(1, 1)
    let pointerInfluence = 0
    let lastPointerInputAt = -100

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x08110d)
    scene.fog = new THREE.FogExp2(0x08110d, 0.045)

    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 50)
    camera.position.z = 3.2
    scene.add(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.className = 'depth-lab__scene'
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
      displacementScale: 0.18,
      roughness: 1,
      metalness: 0,
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.position.z = -0.15
    planeGroup.add(plane)

    const glowGeometry = new THREE.PlaneGeometry(1, 1, 1, 1)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6de0c0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial)
    glowPlane.position.z = -0.8
    planeGroup.add(glowPlane)

    const loadingManager = new THREE.LoadingManager()
    const textureLoader = new THREE.TextureLoader(loadingManager)

    loadingManager.onLoad = () => {
      if (!disposed) {
        onLoadingStateChange?.('ready')
      }
    }

    loadingManager.onError = () => {
      if (!disposed) {
        onLoadingStateChange?.('error')
      }
    }

    textureLoader.load(
      JUNGLE_IMAGE_PATH,
      (texture) => {
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
      },
      undefined,
      () => onLoadingStateChange?.('error'),
    )

    textureLoader.load(
      JUNGLE_DEPTH_MAP_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }

        depthTexture = texture
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        planeMaterial.displacementMap = texture
        planeMaterial.needsUpdate = true
      },
      undefined,
      () => onLoadingStateChange?.('error'),
    )

    const fitPlane = () => {
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.abs(camera.position.z - plane.position.z)
      const viewWidth = viewHeight * aspect
      planeScale.set(viewWidth * 1.18, viewHeight * 1.28)
      plane.scale.set(planeScale.x, planeScale.y, 1)
      glowPlane.scale.set(planeScale.x * 1.14, planeScale.y * 1.08, 1)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      lastPointerInputAt = timer.getElapsed()
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
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('resize', handleResize)
    fitPlane()

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)

      timer.update()

      const elapsed = timer.getElapsed()
      const stateProfile = STATE_MOTION[configRef.current.playbackState]
      const motionAmount = reducedMotionQuery.matches ? 0 : configRef.current.motionIntensity * stateProfile.motion
      const baseDepth = configRef.current.depthStrength * stateProfile.depth
      const ambientEnabled = configRef.current.autoMotionEnabled && !reducedMotionQuery.matches
      const pointerEnabled = configRef.current.pointerParallaxEnabled && !reducedMotionQuery.matches
      const autoAmount = ambientEnabled ? motionAmount : 0

      pointer.lerp(pointerTarget, 0.05)

      autonomousPointer.x = Math.sin(elapsed * stateProfile.driftSpeed) * stateProfile.driftAmount * autoAmount
      autonomousPointer.y =
        Math.sin(elapsed * stateProfile.driftSpeed * 0.65) *
        Math.cos(elapsed * stateProfile.driftSpeed * 0.42) *
        stateProfile.driftAmount *
        autoAmount *
        0.82

      const pointerIsActive = elapsed - lastPointerInputAt <= POINTER_IDLE_TIMEOUT_SECONDS
      const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0
      pointerInfluence = THREE.MathUtils.lerp(pointerInfluence, pointerInfluenceTarget, 0.045)

      blendedPointer.x = THREE.MathUtils.lerp(autonomousPointer.x, pointer.x * motionAmount, pointerInfluence)
      blendedPointer.y = THREE.MathUtils.lerp(autonomousPointer.y, pointer.y * motionAmount, pointerInfluence)

      const breathingAmplitude = ambientEnabled ? stateProfile.breathAmplitude * autoAmount : 0
      const breathingSpeed = stateProfile.breathSpeed
      const effectiveDepth = THREE.MathUtils.clamp(
        baseDepth + Math.sin(elapsed * breathingSpeed) * breathingAmplitude,
        0,
        1,
      )

      planeMaterial.displacementScale = 0.04 + effectiveDepth * 0.32
      planeMaterial.bumpScale = effectiveDepth * 0.04

      planeGroup.position.x = Math.sin(elapsed * 0.16) * 0.06 * (0.2 + autoAmount) + blendedPointer.x * 0.14
      planeGroup.position.y = Math.cos(elapsed * 0.12) * 0.04 * (0.2 + autoAmount) - blendedPointer.y * 0.11
      planeGroup.rotation.y = Math.sin(elapsed * 0.1) * 0.022 * (0.22 + autoAmount) + blendedPointer.x * 0.13
      planeGroup.rotation.x = Math.cos(elapsed * 0.085) * 0.016 * (0.2 + autoAmount) - blendedPointer.y * 0.1
      plane.position.z = -0.15 + Math.sin(elapsed * 0.22) * 0.06 * (0.16 + autoAmount)
      glowPlane.material.opacity = 0.05 + effectiveDepth * 0.06

      camera.position.x = blendedPointer.x * 0.06
      camera.position.y = -blendedPointer.y * 0.045
      camera.lookAt(0, 0, -0.4)

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrameId)
      timer.disconnect()
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
  }, [onLoadingStateChange])

  return <div ref={mountRef} className="depth-lab__scene" />
}

export default JungleDepthScene
