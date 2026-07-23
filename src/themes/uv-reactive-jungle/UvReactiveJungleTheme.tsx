import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  UV_JUNGLE_PRODUCTION_ASSET,
  UV_JUNGLE_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./uvReactiveJungle.css";

function UvReactiveJungleTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={UV_JUNGLE_PRODUCTION_ASSET}
      scenePreset={UV_JUNGLE_PRODUCTION_SCENE_PRESET}
      className="uv-reactive-jungle-scene"
    />
  );
}

export default UvReactiveJungleTheme;
