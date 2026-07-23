import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  FEMALE_DJ_1_PRODUCTION_ASSET,
  FEMALE_DJ_1_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./femaleDj1.css";

function FemaleDj1Theme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={FEMALE_DJ_1_PRODUCTION_ASSET}
      scenePreset={FEMALE_DJ_1_PRODUCTION_SCENE_PRESET}
      className="female-dj-1-scene"
    />
  );
}

export default FemaleDj1Theme;