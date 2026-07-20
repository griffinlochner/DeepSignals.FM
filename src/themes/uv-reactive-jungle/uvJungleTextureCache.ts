export const UV_JUNGLE_COLOR_IMAGE_URL = "/experiments/environment-lab/jungle-color.png";
export const UV_JUNGLE_DEPTH_MAP_URL = "/experiments/environment-lab/jungle-depth.png";

let preloadPromise: Promise<void> | null = null;

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    const finalize = () => {
      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => {
      if (typeof image.decode === "function") {
        void image
          .decode()
          .then(() => {
            finalize();
            resolve();
          })
          .catch(() => {
            finalize();
            resolve();
          });
        return;
      }

      finalize();
      resolve();
    };

    image.onerror = () => {
      finalize();
      reject(new Error(`Failed to preload ${url}`));
    };

    image.decoding = "async";
    image.src = url;
  });
}

export function preloadUvJungleTextures() {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = Promise.all([
    preloadImage(UV_JUNGLE_COLOR_IMAGE_URL),
    preloadImage(UV_JUNGLE_DEPTH_MAP_URL),
  ])
    .then(() => undefined)
    .catch((error) => {
      preloadPromise = null;
      throw error;
    });

  return preloadPromise;
}
