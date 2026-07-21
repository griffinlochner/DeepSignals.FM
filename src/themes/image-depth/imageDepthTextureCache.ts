import * as THREE from "three";
import type { ImageDepthAsset } from "./types";

type ImageDepthTexturePair = {
  colorTexture: THREE.Texture;
  depthTexture: THREE.Texture;
};

const textureLoader = new THREE.TextureLoader();
const texturePairPromises = new Map<string, Promise<ImageDepthTexturePair>>();

function textureCacheKey(asset: ImageDepthAsset) {
  return `${asset.id}|${asset.colorImageUrl}|${asset.depthMapUrl}`;
}

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    textureLoader.load(url, resolve, undefined, reject);
  });
}

function getOrCreateTexturePairPromise(asset: ImageDepthAsset) {
  const key = textureCacheKey(asset);
  const cached = texturePairPromises.get(key);

  if (cached) {
    return cached;
  }

  const promise = Promise.all([
    loadTexture(asset.colorImageUrl),
    loadTexture(asset.depthMapUrl),
  ])
    .then(([colorTexture, depthTexture]) => {
      colorTexture.colorSpace = THREE.SRGBColorSpace;
      colorTexture.minFilter = THREE.LinearFilter;
      colorTexture.magFilter = THREE.LinearFilter;
      colorTexture.generateMipmaps = false;

      depthTexture.minFilter = THREE.LinearFilter;
      depthTexture.magFilter = THREE.LinearFilter;
      depthTexture.generateMipmaps = false;

      return {
        colorTexture,
        depthTexture,
      };
    })
    .catch((error) => {
      texturePairPromises.delete(key);
      throw error;
    });

  texturePairPromises.set(key, promise);
  return promise;
}

export function preloadImageDepthTextures(asset: ImageDepthAsset) {
  return getOrCreateTexturePairPromise(asset).then(() => undefined);
}

export function getImageDepthTexturePair(asset: ImageDepthAsset) {
  return getOrCreateTexturePairPromise(asset);
}
