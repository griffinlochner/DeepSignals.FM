import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_ASSET,
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./bioluminescentPsyForest.css";

function BioluminescentPsyForestTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={BIOLUMINESCENT_PSY_FOREST_PRODUCTION_ASSET}
      scenePreset={BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET}
      className="bioluminescent-psy-forest-scene"
    />
  );
}

export default BioluminescentPsyForestTheme;