import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  SLIME_CAVERN_PRODUCTION_ASSET,
  SLIME_CAVERN_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./slimeCavern.css";

function SlimeCavernTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={SLIME_CAVERN_PRODUCTION_ASSET}
      scenePreset={SLIME_CAVERN_PRODUCTION_SCENE_PRESET}
      className="slime-cavern-scene"
    />
  );
}

export default SlimeCavernTheme;