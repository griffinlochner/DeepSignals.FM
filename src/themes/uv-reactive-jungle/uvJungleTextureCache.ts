import { preloadImageDepthTextures } from "../image-depth/imageDepthTextureCache";
import { UV_JUNGLE_PRODUCTION_ASSET } from "../image-depth/productionScenePresets";

let preloadPromise: Promise<void> | null = null;

export function preloadUvJungleTextures() {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = preloadImageDepthTextures(UV_JUNGLE_PRODUCTION_ASSET)
    .then(() => undefined)
    .catch((error) => {
      preloadPromise = null;
      throw error;
    });

  return preloadPromise;
}
