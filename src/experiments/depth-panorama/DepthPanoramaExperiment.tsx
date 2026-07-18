import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './depthPanoramaExperiment.css'

type LoadingState = 'loading' | 'ready' | 'error'

const PANORAMA_PATH = `${import.meta.env.BASE_URL}experiments/depth-panorama/kandao3.jpg`
const DEPTH_MAP_PATH = `${import.meta.env.BASE_URL}experiments/depth-panorama/kandao3_depthmap.jpg`

function DepthPanoramaExperiment() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    let disposed = false
    let animationFrameId = 0
    let panoramaTexture: THREE.Texture | null = null
    let depthTexture: THREE.Texture | null = null

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / Math.max(mount.clientHeight, 1), 1, 2000)
    scene.add(camera)

    const ambientLight = new THREE.AmbientLight(0xffffff, 3)
    scene.add(ambientLight)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.className = 'depth-panorama-experiment__canvas'
    mount.appendChild(renderer.domElement)

    const sphereGeometry = new THREE.SphereGeometry(6, 256, 256)
    const sphereMaterial = new THREE.MeshStandardMaterial({
      side: THREE.BackSide,
      displacementScale: -4,
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)

    const loadingManager = new THREE.LoadingManager()
    const textureLoader = new THREE.TextureLoader(loadingManager)

    loadingManager.onLoad = () => {
      if (disposed) {
        return
      }

      scene.add(sphere)
      setLoadingState('ready')
    }

    loadingManager.onError = () => {
      if (!disposed) {
        setLoadingState('error')
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
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        sphereMaterial.map = texture
        sphereMaterial.needsUpdate = true
      },
      undefined,
      () => {
        if (!disposed) {
          setLoadingState('error')
        }
      },
    )

    textureLoader.load(
      DEPTH_MAP_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }

        depthTexture = texture
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        sphereMaterial.displacementMap = texture
        sphereMaterial.needsUpdate = true
      },
      undefined,
      () => {
        if (!disposed) {
          setLoadingState('error')
        }
      },
    )

    const timer = new THREE.Timer()
    timer.connect(document)
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      timer.update()

      if (!reducedMotionQuery.matches) {
        const elapsed = timer.getElapsed()
        const delta = Math.min(timer.getDelta(), 0.05)

        sphere.rotation.y += delta * 0.06
        sphere.position.x = Math.sin(elapsed) * 0.2
        sphere.position.z = Math.cos(elapsed) * 0.2
      }

      renderer.render(scene, camera)
    }

    const handleResize = () => {
      const width = mount.clientWidth
      const height = Math.max(mount.clientHeight, 1)

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      timer.disconnect()

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
  }, [])

  return (
    <main className="depth-panorama-experiment">
      <div ref={mountRef} className="depth-panorama-experiment__viewport" aria-hidden="true" />

      <div className="depth-panorama-experiment__hud">
        <p className="depth-panorama-experiment__eyebrow">DeepSignals.FM experiment</p>
        <h1>Depth panorama proof of concept</h1>
        <p>
          {loadingState === 'loading' && 'Loading panorama and depth map…'}
          {loadingState === 'ready' && 'Beach panorama loaded — displaced sphere motion active.'}
          {loadingState === 'error' && 'The panorama assets could not be loaded.'}
        </p>
      </div>
    </main>
  )
}

export default DepthPanoramaExperiment
