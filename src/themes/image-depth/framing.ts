import * as THREE from "three";

export const IMAGE_DEPTH_PARITY_FRAMING = {
  cameraFovDegrees: 46,
  cameraZ: 3.2,
  planeZ: -0.15,
  scaleXMultiplier: 1.18,
  scaleYMultiplier: 1.28,
} as const;

export function computeFramedPlaneScale(params: {
  viewportWidth: number;
  viewportHeight: number;
  cameraFovDegrees?: number;
  cameraZ?: number;
  planeZ?: number;
  scaleXMultiplier?: number;
  scaleYMultiplier?: number;
}) {
  const cameraFovDegrees = params.cameraFovDegrees ?? IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees;
  const cameraZ = params.cameraZ ?? IMAGE_DEPTH_PARITY_FRAMING.cameraZ;
  const planeZ = params.planeZ ?? IMAGE_DEPTH_PARITY_FRAMING.planeZ;
  const scaleXMultiplier = params.scaleXMultiplier ?? IMAGE_DEPTH_PARITY_FRAMING.scaleXMultiplier;
  const scaleYMultiplier = params.scaleYMultiplier ?? IMAGE_DEPTH_PARITY_FRAMING.scaleYMultiplier;

  const safeWidth = Math.max(params.viewportWidth, 1);
  const safeHeight = Math.max(params.viewportHeight, 1);
  const aspect = safeWidth / safeHeight;

  const viewHeight =
    2 * Math.tan(THREE.MathUtils.degToRad(cameraFovDegrees / 2)) * Math.abs(cameraZ - planeZ);
  const viewWidth = viewHeight * aspect;

  return {
    width: viewWidth * scaleXMultiplier,
    height: viewHeight * scaleYMultiplier,
  };
}
