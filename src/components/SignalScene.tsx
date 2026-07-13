import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function SignalScene() {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return
    }

    /*
     * SCENE, CAMERA, AND RENDERER
     */

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020202)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )

    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    mount.appendChild(renderer.domElement)

    /*
     * RESOURCE TRACKING
     *
     * Three.js geometries and materials use GPU resources.
     * We keep track of them so they can be disposed when
     * this React component is removed.
     */

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

    /*
     * ANTENNA ROOT
     *
     * This group controls the position of the entire antenna.
     */

    const antennaRoot = new THREE.Group()

    antennaRoot.position.set(2.25, -1.45, -0.4)
    antennaRoot.scale.setScalar(0.9)

    scene.add(antennaRoot)

    /*
     * BASE MATERIALS
     */

    const baseMaterial = new THREE.MeshBasicMaterial({
      color: 0x100b22,
    })

    const baseOutlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    })

    materials.push(baseMaterial, baseOutlineMaterial)

    /*
     * PEDESTAL
     */

    const pedestalGeometry = new THREE.CylinderGeometry(
      0.34,
      0.48,
      0.72,
      6,
    )

    geometries.push(pedestalGeometry)

    const pedestal = new THREE.Mesh(
      pedestalGeometry,
      baseMaterial,
    )

    pedestal.position.y = 0.36
    antennaRoot.add(pedestal)

    const pedestalOutline = new THREE.Mesh(
      pedestalGeometry,
      baseOutlineMaterial,
    )

    pedestalOutline.position.copy(pedestal.position)
    pedestalOutline.scale.setScalar(1.015)

    antennaRoot.add(pedestalOutline)

    /*
     * ROTATING MOUNT
     */

    const mountGeometry = new THREE.BoxGeometry(
      0.7,
      0.22,
      0.55,
    )

    geometries.push(mountGeometry)

    const mountBlock = new THREE.Mesh(
      mountGeometry,
      baseMaterial,
    )

    mountBlock.position.y = 0.82
    antennaRoot.add(mountBlock)

    const mountOutline = new THREE.Mesh(
      mountGeometry,
      baseOutlineMaterial,
    )

    mountOutline.position.copy(mountBlock.position)
    mountOutline.scale.setScalar(1.015)

    antennaRoot.add(mountOutline)

    /*
     * DISH PIVOT
     *
     * The base remains upright. Only this group is aimed
     * toward the upper-left.
     */

    const dishPivot = new THREE.Group()

    dishPivot.position.set(0, 1.02, 0)
    antennaRoot.add(dishPivot)

    /*
     * PARABOLIC DISH GEOMETRY
     *
     * The dish is constructed facing along its local
     * positive Z axis.
     *
     * The center is recessed toward negative Z while
     * the rim remains near Z = 0.
     */

    const outerRadius = 1.22
    const dishDepth = 0.5
    const radialSegments = 12
    const angularSegments = 48

    const dishPositions: number[] = []
    const dishIndices: number[] = []

    for (
      let radialIndex = 0;
      radialIndex <= radialSegments;
      radialIndex += 1
    ) {
      const radiusRatio = radialIndex / radialSegments
      const radius = outerRadius * radiusRatio

      const z =
        -dishDepth * (1 - radiusRatio * radiusRatio)

      for (
        let angularIndex = 0;
        angularIndex <= angularSegments;
        angularIndex += 1
      ) {
        const angle =
          (angularIndex / angularSegments) *
          Math.PI *
          2

        dishPositions.push(
          radius * Math.cos(angle),
          radius * Math.sin(angle),
          z,
        )
      }
    }

    const rowLength = angularSegments + 1

    for (
      let radialIndex = 0;
      radialIndex < radialSegments;
      radialIndex += 1
    ) {
      for (
        let angularIndex = 0;
        angularIndex < angularSegments;
        angularIndex += 1
      ) {
        const current =
          radialIndex * rowLength + angularIndex

        const next = current + rowLength

        dishIndices.push(
          current,
          next,
          current + 1,
          next,
          next + 1,
          current + 1,
        )
      }
    }

    const dishGeometry = new THREE.BufferGeometry()

    dishGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        dishPositions,
        3,
      ),
    )

    dishGeometry.setIndex(dishIndices)
    dishGeometry.computeVertexNormals()

    geometries.push(dishGeometry)

    /*
     * DISH MATERIALS
     */

    const dishMaterial = new THREE.MeshBasicMaterial({
      color: 0x08050f,
      side: THREE.DoubleSide,
    })

    const dishWireMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x39ff14,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })

    materials.push(dishMaterial, dishWireMaterial)

    const solidDish = new THREE.Mesh(
      dishGeometry,
      dishMaterial,
    )

    dishPivot.add(solidDish)

    const wireDish = new THREE.Mesh(
      dishGeometry,
      dishWireMaterial,
    )

    wireDish.scale.setScalar(1.004)
    dishPivot.add(wireDish)

    /*
     * NEON OUTER RIM
     */

    const neonMaterial = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
    })

    materials.push(neonMaterial)

    const rimGeometry = new THREE.TorusGeometry(
      outerRadius,
      0.035,
      10,
      64,
    )

    geometries.push(rimGeometry)

    const rim = new THREE.Mesh(
      rimGeometry,
      neonMaterial,
    )

    dishPivot.add(rim)

    /*
     * RECEIVER
     */

    const receiverGeometry =
      new THREE.SphereGeometry(
        0.09,
        16,
        16,
      )

    geometries.push(receiverGeometry)

    const receiver = new THREE.Mesh(
      receiverGeometry,
      neonMaterial,
    )

    receiver.position.set(0, 0, 0.72)
    dishPivot.add(receiver)

    /*
     * RECEIVER SUPPORT ARMS
     */

    const createSupportArm = (
      start: THREE.Vector3,
      end: THREE.Vector3,
    ) => {
      const direction = end.clone().sub(start)
      const length = direction.length()

      const midpoint = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)

      const armGeometry =
        new THREE.CylinderGeometry(
          0.015,
          0.015,
          length,
          8,
        )

      geometries.push(armGeometry)

      const arm = new THREE.Mesh(
        armGeometry,
        neonMaterial,
      )

      arm.position.copy(midpoint)

      arm.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      )

      dishPivot.add(arm)
    }

    const receiverPosition =
      receiver.position.clone()

    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2

      const rimPoint = new THREE.Vector3(
        outerRadius * 0.82 * Math.cos(angle),
        outerRadius * 0.82 * Math.sin(angle),
        -0.16,
      )

      createSupportArm(
        rimPoint,
        receiverPosition,
      )
    }

    /*
     * AIM THE DISH TOWARD THE UPPER-LEFT
     */

    const localDishForward =
      new THREE.Vector3(0, 0, 1)

    const aimDirection = new THREE.Vector3(
      -1,
      0.75,
      0.15,
    ).normalize()

    dishPivot.quaternion.setFromUnitVectors(
      localDishForward,
      aimDirection,
    )

    const baseDishQuaternion =
      dishPivot.quaternion.clone()

    /*
     * STAR FIELD
     */

    const starCount = 1500
    const starPositions = new Float32Array(
      starCount * 3,
    )

    for (let i = 0; i < starCount; i += 1) {
      const spread = 120

      starPositions[i * 3] =
        (Math.random() - 0.5) * 2 * spread

      starPositions[i * 3 + 1] =
        (Math.random() - 0.5) * 2 * spread

      starPositions[i * 3 + 2] =
        (Math.random() - 0.5) *
          2 *
          spread -
        100
    }

    const starGeometry =
      new THREE.BufferGeometry()

    starGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        starPositions,
        3,
      ),
    )

    geometries.push(starGeometry)

    const starMaterial =
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.04,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })

    materials.push(starMaterial)

    const stars = new THREE.Points(
      starGeometry,
      starMaterial,
    )

    scene.add(stars)

    /*
     * ANIMATION
     */

    let animationFrameId = 0

    const basePosition =
      antennaRoot.position.clone()

    const animate = () => {
      animationFrameId =
        window.requestAnimationFrame(animate)

      const time =
        performance.now() * 0.0006

      antennaRoot.position.y =
        basePosition.y +
        Math.sin(time) * 0.035

      antennaRoot.position.x =
        basePosition.x +
        Math.cos(time * 0.7) * 0.02

      /*
       * Preserve the dish's upper-left aim.
       * We are not rotating it freely yet.
       */

      dishPivot.quaternion.copy(
        baseDishQuaternion,
      )

      renderer.render(scene, camera)
    }

    animate()

    /*
     * WINDOW RESIZING
     */

    const handleResize = () => {
      camera.aspect =
        window.innerWidth /
        window.innerHeight

      camera.updateProjectionMatrix()

      renderer.setSize(
        window.innerWidth,
        window.innerHeight,
      )

      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio,
          2,
        ),
      )
    }

    window.addEventListener(
      'resize',
      handleResize,
    )

    /*
     * CLEANUP
     */

    return () => {
      window.removeEventListener(
        'resize',
        handleResize,
      )

      window.cancelAnimationFrame(
        animationFrameId,
      )

      geometries.forEach((geometry) => {
        geometry.dispose()
      })

      materials.forEach((material) => {
        material.dispose()
      })

      renderer.dispose()

      if (
        mount.contains(renderer.domElement)
      ) {
        mount.removeChild(
          renderer.domElement,
        )
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#020202',
      }}
    />
  )
}

export default SignalScene