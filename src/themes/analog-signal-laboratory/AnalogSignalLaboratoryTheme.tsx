import type { ThemeSceneProps } from "../themeTypes";
import { ImageDepthThemeScene } from "../image-depth/ImageDepthThemeScene";
import {
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_ASSET,
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET,
} from "../image-depth/productionScenePresets";
import "./analogSignalLaboratory.css";

function AnalogSignalLaboratoryTheme(props: ThemeSceneProps) {
  return (
    <ImageDepthThemeScene
      {...props}
      asset={ANALOG_SIGNAL_LABORATORY_PRODUCTION_ASSET}
      scenePreset={ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET}
      className="analog-signal-laboratory-scene"
    />
  );
}

export default AnalogSignalLaboratoryTheme;
