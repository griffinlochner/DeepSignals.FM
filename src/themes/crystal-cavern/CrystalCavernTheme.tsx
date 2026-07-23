import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  CRYSTAL_CAVERN_PRODUCTION_ASSET,
  CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./crystalCavern.css";

function CrystalCavernTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={CRYSTAL_CAVERN_PRODUCTION_ASSET}
      scenePreset={CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET}
      className="crystal-cavern-scene"
    />
  );
}

export default CrystalCavernTheme;