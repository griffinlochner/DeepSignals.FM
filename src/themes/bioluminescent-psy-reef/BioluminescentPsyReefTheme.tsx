import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_ASSET,
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./bioluminescentPsyReef.css";

function BioluminescentPsyReefTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={BIOLUMINESCENT_PSY_REEF_PRODUCTION_ASSET}
      scenePreset={BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET}
      className="bioluminescent-psy-reef-scene"
    />
  );
}

export default BioluminescentPsyReefTheme;