import assert from "node:assert/strict";
import {
  CHROMA_HUE_RESPONSE,
  applyChromaHueResponse,
  mapSmoothedEnergyToHue,
} from "../src/app/sharedChroma";

assert.equal(mapSmoothedEnergyToHue(0), -180);
assert.equal(mapSmoothedEnergyToHue(0.5), 0);
assert.equal(mapSmoothedEnergyToHue(1), 180);

const currentHue = 0;
const targetHue = 180;
const smoothed = applyChromaHueResponse(currentHue, targetHue, CHROMA_HUE_RESPONSE);

assert.ok(Math.abs(smoothed - 14.4) < 1e-9, `expected 14.4, received ${smoothed}`);

console.log("shared chroma checks passed");
