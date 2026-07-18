import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { DepthLabSceneProps, DepthLabPlaybackState } from '../types'

const PANORAMA_PATH = `${import.meta.env.BASE_URL}experiments/depth-panorama/kandao3.jpg`
const DEPTH_MAP_PATH = `${import.meta.env.BASE_URL}experiments/depth-panorama/kandao3_depthmap.jpg`

const STATE_MOTION: Record<DepthLabPlaybackState, { motion: number; depth: number }> = {
  dormant: { motion: 0.16, depth: 0.45 },
  armed: { motion: 0.32, depth: 0.72 },
  playing: { motion: 0.56, depth: 1 },
}

function BeachPanoramaScene({
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
    let panoramaTexture: THREE.Texture | null = null
    let depthTexture: THREE.Texture | null = null

    const pointer = new THREE.Vector2(0, 0)
    const pointerTarget = new THREE.Vector2(0, 0)
    const lookTarget = new THREE.Vector3()

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x081014)

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 2000)
    scene.add(camera)

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.6)
    const fillLight = new THREE.DirectionalLight(0xfff6dd, 1.1)
    fillLight.position.set(-2, 1, 3)
    scene.add(ambientLight, fillLight)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.className = 'depth-lab__scene'
    mount.appendChild(renderer.domElement)

    const sphereGeometry = new THREE.SphereGeometry(6, 256, 256)
    const sphereMaterial = new THREE.MeshStandardMaterial({
      side: THREE.BackSide,
      displacementScale: -2.4,
      roughness: 1,
      metalness: 0,
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)

    const loadingManager = new THREE.LoadingManager()
    const textureLoader = new THREE.TextureLoader(loadingManager)

    loadingManager.onLoad = () => {
      if (disposed) {
        return
      }

      scene.add(sphere)
      onLoadingStateChange?.('ready')
    }

    loadingManager.onError = () => {
      if (!disposed) {
        onLoadingStateChange?.('error')
      }
    }

    textureLoader.load(
      PANORAMA_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }

        panoramaTexture = texture
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        sphereMaterial.map = texture
        sphereMaterial.needsUpdate = true
      },
      undefined,
      () => onLoadingStateChange?.('error'),
    )

    textureLoader.load(
      DEPTH_MAP_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }

        depthTexture = texture
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        sphereMaterial.displacementMap = texture
        sphereMaterial.needsUpdate = true
      },
      undefined,
      () => onLoadingStateChange?.('error'),
    )

    const timer = new THREE.Timer()
    timer.connect(document)
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0)
    }

    const handleResize = () => {
      const width = mount.clientWidth
      const height = Math.max(mount.clientHeight, 1)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
    }

    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('resize', handleResize)

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)

      timer.update()

      const elapsed = timer.getElapsed()
      const delta = Math.min(timer.getDelta(), 0.05)
      const stateProfile = STATE_MOTION[configRef.current.playbackState]
      const motionAmount = reducedMotionQuery.matches ? 0 : configRef.current.motionIntensity * stateProfile.motion
      const depthAmount = configRef.current.depthStrength * stateProfile.depth
      const pointerAmount = configRef.current.pointerParallaxEnabled && !reducedMotionQuery.matches ? motionAmount : 0
      const autoAmount = configRef.current.autoMotionEnabled && !reducedMotionQuery.matches ? motionAmount : 0

      pointer.lerp(pointerTarget, 0.05)
      sphereMaterial.displacementScale = -0.55 - depthAmount * 2.8

      sphere.rotation.y += delta * (0.003 + autoAmount * 0.04)
      sphere.rotation.x = Math.sin(elapsed * 0.12) * 0.01 * (0.3 + motionAmount)
      sphere.position.x = Math.sin(elapsed * 0.18) * 0.1 * (0.2 + autoAmount)
      sphere.position.y = Math.cos(elapsed * 0.1) * 0.06 * (0.25 + motionAmount)
      sphere.position.z = Math.cos(elapsed * 0.16) * 0.08 * (0.18 + autoAmount)

      camera.position.x = pointer.x * 0.16 * pointerAmount
      camera.position.y = -pointer.y * 0.1 * pointerAmount + Math.sin(elapsed * 0.2) * 0.02 * (0.15 + motionAmount)
      camera.position.z = 0.01
      lookTarget.set(pointer.x * 0.18 * pointerAmount, -pointer.y * 0.12 * pointerAmount, -1)
      camera.lookAt(lookTarget)

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

      panoramaTexture?.dispose()
      depthTexture?.dispose()
      sphereGeometry.dispose()
      sphereMaterial.dispose()
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

export default BeachPanoramaScene
