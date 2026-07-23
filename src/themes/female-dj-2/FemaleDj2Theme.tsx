import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  FEMALE_DJ_2_PRODUCTION_ASSET,
  FEMALE_DJ_2_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./femaleDj2.css";

function FemaleDj2Theme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={FEMALE_DJ_2_PRODUCTION_ASSET}
      scenePreset={FEMALE_DJ_2_PRODUCTION_SCENE_PRESET}
      className="female-dj-2-scene"
    />
  );
}

export default FemaleDj2Theme;