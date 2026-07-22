import * as THREE from "three";

export const IMAGE_DEPTH_PARITY_FRAMING = {
  cameraFovDegrees: 46,
  cameraZ: 3.2,
  planeZ: -0.15,
} as const;

const SHARED_MOTION_FRAMING = {
  planeAmbientPositionX: 0.06,
  planeAmbientPositionY: 0.04,
  planePointerPositionX: 0.14,
  planePointerPositionY: 0.11,
  planeAmbientRotationY: 0.022,
  planeAmbientRotationX: 0.016,
  planePointerRotationY: 0.13,
  planePointerRotationX: 0.1,
  planeAmbientZTravel: 0.06,
  cameraPointerPositionX: 0.06,
  cameraPointerPositionY: 0.045,
} as const;

const DEFAULT_MAX_AUTONOMOUS_POINTER_X = 1;
const DEFAULT_MAX_AUTONOMOUS_POINTER_Y = 0.33;
const DEFAULT_NDC_EDGE_SAFETY_INSET = 0.001;
const FULL_ON_AUTONOMOUS_CIRCUIT_SECONDS = 30;
const FULL_ON_AUTONOMOUS_SAMPLE_COUNT = 720;

export type ImageDepthFramingMode = "cover-safe-overscan" | "contain";

export type ImageDepthFramingMotionProfile = {
  pointerParallaxEnabled: boolean;
  motionIntensity: number;
  pointerParallaxStrength: number;
};

export type ImageDepthFramingResult = {
  width: number;
  height: number;
  widthScaleToViewport: number;
  heightScaleToViewport: number;
  overscanScale: number;
};

function resolveViewDimensions(params: {
  viewportWidth: number;
  viewportHeight: number;
  cameraFovDegrees: number;
  cameraZ: number;
  planeZ: number;
}) {
  const safeWidth = Math.max(params.viewportWidth, 1);
  const safeHeight = Math.max(params.viewportHeight, 1);
  const aspect = safeWidth / safeHeight;

  const viewHeight =
    2 * Math.tan(THREE.MathUtils.degToRad(params.cameraFovDegrees / 2)) * Math.abs(params.cameraZ - params.planeZ);
  const viewWidth = viewHeight * aspect;

  return {
    viewWidth,
    viewHeight,
    aspect,
  };
}

function resolveBaseAspectScale(params: {
  mode: ImageDepthFramingMode;
  assetAspectRatio: number;
  viewportAspectRatio: number;
  viewWidth: number;
  viewHeight: number;
}) {
  const safeAssetAspect = Number.isFinite(params.assetAspectRatio) && params.assetAspectRatio > 0
    ? params.assetAspectRatio
    : 1;

  if (params.mode === "contain") {
    if (safeAssetAspect >= params.viewportAspectRatio) {
      return {
        width: params.viewWidth,
        height: params.viewWidth / safeAssetAspect,
      };
    }

    return {
      width: params.viewHeight * safeAssetAspect,
      height: params.viewHeight,
    };
  }

  if (safeAssetAspect >= params.viewportAspectRatio) {
    return {
      width: params.viewHeight * safeAssetAspect,
      height: params.viewHeight,
    };
  }

  return {
    width: params.viewWidth,
    height: params.viewWidth / safeAssetAspect,
  };
}

function resolveAutonomousMotionAmount(profile: ImageDepthFramingMotionProfile | undefined) {
  if (!profile?.pointerParallaxEnabled) {
    return 0;
  }

  const motionAmount = Math.max(0, profile.motionIntensity) * Math.max(0, profile.pointerParallaxStrength);
  return THREE.MathUtils.clamp(0.18 + motionAmount * 0.32, 0.18, 0.52);
}

function resolveAutonomousPointerAtSeconds(
  elapsedSeconds: number,
  maximumPointerX: number,
  maximumPointerY: number,
) {
  const phase = (elapsedSeconds / FULL_ON_AUTONOMOUS_CIRCUIT_SECONDS) * Math.PI * 2;

  const normalizedX =
    Math.sin(phase) * 1.03 +
    Math.sin(phase * 3 + 0.3) * 0.07 +
    Math.sin(phase * 5 - 0.45) * 0.03;
  const normalizedY =
    Math.sin(phase * 0.84 + Math.PI * 0.52) * 0.74 +
    Math.sin(phase * 1.86 + 0.24) * 0.16 +
    Math.cos(phase * 0.58 + 0.2) * 0.05;

  return {
    x: THREE.MathUtils.clamp(normalizedX, -1, 1) * maximumPointerX,
    y: THREE.MathUtils.clamp(normalizedY, -1, 1) * maximumPointerY,
  };
}

function resolveMaxNdcExposure(params: {
  viewportAspectRatio: number;
  cameraFovDegrees: number;
  cameraZ: number;
  planeBaseZ: number;
  baseWidth: number;
  baseHeight: number;
  overscanScale: number;
  motionProfile?: ImageDepthFramingMotionProfile;
  maximumPointerX: number;
  maximumPointerY: number;
  ndcSafetyInset: number;
}) {
  const camera = new THREE.PerspectiveCamera(params.cameraFovDegrees, params.viewportAspectRatio, 0.1, 80);
  const group = new THREE.Group();
  const corners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];

  const autoAmount = resolveAutonomousMotionAmount(params.motionProfile);
  const ndcMin = -1 - params.ndcSafetyInset;
  const ndcMax = 1 + params.ndcSafetyInset;

  const halfWidth = (params.baseWidth * params.overscanScale) * 0.5;
  const halfHeight = (params.baseHeight * params.overscanScale) * 0.5;

  let worstExposure = 0;

  for (let sampleIndex = 0; sampleIndex < FULL_ON_AUTONOMOUS_SAMPLE_COUNT; sampleIndex += 1) {
    const elapsedSeconds =
      (sampleIndex / FULL_ON_AUTONOMOUS_SAMPLE_COUNT) * FULL_ON_AUTONOMOUS_CIRCUIT_SECONDS;
    const pointer = resolveAutonomousPointerAtSeconds(
      elapsedSeconds,
      params.maximumPointerX,
      params.maximumPointerY,
    );

    const planeX =
      Math.sin(elapsedSeconds * 0.16) * SHARED_MOTION_FRAMING.planeAmbientPositionX * autoAmount +
      pointer.x * SHARED_MOTION_FRAMING.planePointerPositionX;
    const planeY =
      Math.cos(elapsedSeconds * 0.12) * SHARED_MOTION_FRAMING.planeAmbientPositionY * autoAmount -
      pointer.y * SHARED_MOTION_FRAMING.planePointerPositionY;
    const rotationY =
      Math.sin(elapsedSeconds * 0.1) * SHARED_MOTION_FRAMING.planeAmbientRotationY * autoAmount +
      pointer.x * SHARED_MOTION_FRAMING.planePointerRotationY;
    const rotationX =
      Math.cos(elapsedSeconds * 0.085) * SHARED_MOTION_FRAMING.planeAmbientRotationX * autoAmount -
      pointer.y * SHARED_MOTION_FRAMING.planePointerRotationX;
    const planeZ =
      params.planeBaseZ +
      Math.sin(elapsedSeconds * 0.22) * SHARED_MOTION_FRAMING.planeAmbientZTravel * autoAmount;

    camera.position.set(
      pointer.x * SHARED_MOTION_FRAMING.cameraPointerPositionX,
      -pointer.y * SHARED_MOTION_FRAMING.cameraPointerPositionY,
      params.cameraZ,
    );
    camera.lookAt(0, 0, -0.4);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    group.position.set(planeX, planeY, 0);
    group.rotation.set(rotationX, rotationY, 0);
    group.updateMatrixWorld(true);

    corners[0].set(-halfWidth, -halfHeight, planeZ).applyMatrix4(group.matrixWorld).project(camera);
    corners[1].set(halfWidth, -halfHeight, planeZ).applyMatrix4(group.matrixWorld).project(camera);
    corners[2].set(halfWidth, halfHeight, planeZ).applyMatrix4(group.matrixWorld).project(camera);
    corners[3].set(-halfWidth, halfHeight, planeZ).applyMatrix4(group.matrixWorld).project(camera);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }

    const leftExposure = Math.max(0, minX - ndcMin);
    const rightExposure = Math.max(0, ndcMax - maxX);
    const bottomExposure = Math.max(0, minY - ndcMin);
    const topExposure = Math.max(0, ndcMax - maxY);

    worstExposure = Math.max(
      worstExposure,
      leftExposure,
      rightExposure,
      bottomExposure,
      topExposure,
    );
  }

  return worstExposure;
}

function solveSafeOverscanScale(params: {
  viewportAspectRatio: number;
  cameraFovDegrees: number;
  cameraZ: number;
  planeBaseZ: number;
  baseWidth: number;
  baseHeight: number;
  motionProfile?: ImageDepthFramingMotionProfile;
  maximumPointerX: number;
  maximumPointerY: number;
  ndcSafetyInset: number;
}) {
  const exposureAtBase = resolveMaxNdcExposure({
    ...params,
    overscanScale: 1,
  });

  if (exposureAtBase <= 0) {
    return 1;
  }

  let low = 1;
  let high = 1.1;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exposure = resolveMaxNdcExposure({
      ...params,
      overscanScale: high,
    });

    if (exposure <= 0) {
      break;
    }

    high *= 1.2;
  }

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const mid = (low + high) * 0.5;
    const exposure = resolveMaxNdcExposure({
      ...params,
      overscanScale: mid,
    });

    if (exposure > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

export function computeImageDepthFraming(params: {
  viewportWidth: number;
  viewportHeight: number;
  assetAspectRatio: number;
  mode: ImageDepthFramingMode;
  cameraFovDegrees?: number;
  cameraZ?: number;
  planeZ?: number;
  motionProfile?: ImageDepthFramingMotionProfile;
  maximumPointerX?: number;
  maximumPointerY?: number;
  ndcSafetyInset?: number;
}): ImageDepthFramingResult {
  const cameraFovDegrees = params.cameraFovDegrees ?? IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees;
  const cameraZ = params.cameraZ ?? IMAGE_DEPTH_PARITY_FRAMING.cameraZ;
  const planeZ = params.planeZ ?? IMAGE_DEPTH_PARITY_FRAMING.planeZ;
  const maximumPointerX = params.maximumPointerX ?? DEFAULT_MAX_AUTONOMOUS_POINTER_X;
  const maximumPointerY = params.maximumPointerY ?? DEFAULT_MAX_AUTONOMOUS_POINTER_Y;
  const ndcSafetyInset = params.ndcSafetyInset ?? DEFAULT_NDC_EDGE_SAFETY_INSET;

  const view = resolveViewDimensions({
    viewportWidth: params.viewportWidth,
    viewportHeight: params.viewportHeight,
    cameraFovDegrees,
    cameraZ,
    planeZ,
  });

  const baseScale = resolveBaseAspectScale({
    mode: params.mode,
    assetAspectRatio: params.assetAspectRatio,
    viewportAspectRatio: view.aspect,
    viewWidth: view.viewWidth,
    viewHeight: view.viewHeight,
  });

  const overscanScale = params.mode === "cover-safe-overscan"
    ? solveSafeOverscanScale({
      viewportAspectRatio: view.aspect,
      cameraFovDegrees,
      cameraZ,
      planeBaseZ: planeZ,
      baseWidth: baseScale.width,
      baseHeight: baseScale.height,
      motionProfile: params.motionProfile,
      maximumPointerX,
      maximumPointerY,
      ndcSafetyInset,
    })
    : 1;

  const finalWidth = baseScale.width * overscanScale;
  const finalHeight = baseScale.height * overscanScale;

  return {
    width: finalWidth,
    height: finalHeight,
    widthScaleToViewport: finalWidth / view.viewWidth,
    heightScaleToViewport: finalHeight / view.viewHeight,
    overscanScale,
  };
}

export function computeFramedPlaneScale(params: {
  viewportWidth: number;
  viewportHeight: number;
  assetAspectRatio?: number;
  mode?: ImageDepthFramingMode;
  motionProfile?: ImageDepthFramingMotionProfile;
  cameraFovDegrees?: number;
  cameraZ?: number;
  planeZ?: number;
}) {
  const framed = computeImageDepthFraming({
    viewportWidth: params.viewportWidth,
    viewportHeight: params.viewportHeight,
    assetAspectRatio: params.assetAspectRatio ?? Math.max(params.viewportWidth, 1) / Math.max(params.viewportHeight, 1),
    mode: params.mode ?? "cover-safe-overscan",
    motionProfile: params.motionProfile,
    cameraFovDegrees: params.cameraFovDegrees,
    cameraZ: params.cameraZ,
    planeZ: params.planeZ,
  });

  return {
    width: framed.width,
    height: framed.height,
  };
}
