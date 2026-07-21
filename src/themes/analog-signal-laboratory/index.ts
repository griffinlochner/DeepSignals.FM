import type { ThemeDefinition } from "../themeTypes";
import AnalogSignalLaboratoryTheme from "./AnalogSignalLaboratoryTheme";

const AnalogSignalLaboratoryDefinition: ThemeDefinition = {
  id: "analog-signal-laboratory",
  name: "Analog Signal Laboratory",
  description: "Image-depth environment authored in the Environment Laboratory and promoted to production player.",
  className: "theme-analog-signal-laboratory",
  performanceTier: "enhanced",
  Scene: AnalogSignalLaboratoryTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
};

export default AnalogSignalLaboratoryDefinition;
