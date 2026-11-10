// Shared directional radiance, as in Twilight Tides: no screen-space overlay or separate reflection pass.
export const toxicAuroraShader = /* glsl */`
  uniform float auroraBass;
  uniform float auroraMids;
  uniform float auroraHighs;
  uniform float eruptionAurora;

  // p is the horizon tangent plane; pixelSize is fwidth(p), taken outside every divergent branch.
  vec4 toxicAurora(vec2 p, vec2 pixelSize, float facingZ) {
    float antialias = 1.0 - smoothstep(0.5, 2.5, pixelSize.x * 171.0 + pixelSize.y * 19.0);
    if (p.y < 0.07 || p.y > 0.54 || facingZ > -0.2) return vec4(0.0);
    float skyMask = smoothstep(0.07, 0.17, p.y) * (1.0 - smoothstep(0.36, 0.54, p.y));
    skyMask *= 1.0 - smoothstep(0.85, 1.5, abs(p.x));
    if (skyMask <= 0.0) return vec4(0.0);
    float bass = auroraBass * chroma;
    float mids = auroraMids * chroma;
    float highs = auroraHighs * chroma;
    float surge = eruptionAurora * (0.45 + chroma * 0.55);
    float activity = waterEnergy * chroma + surge * 0.5;
    float t = skyTime * 0.85;
    vec4 light = vec4(0.0);
    for (int layer = 0; layer < TOXIC_AURORA_LAYERS; layer++) {
      float n = float(layer);
      float x = p.x + n * 0.21;
      float fold = sin(x * 8.0 + t * 0.65 + n * 1.7);
      // Alternating tilts make the curtains cross behind the volcano instead of stacking as stripes.
      float ridge = 0.14 + n * 0.048 + p.x * (0.105 - n * 0.068) + surge * 0.014 * (n - 1.0)
        + sin(x * 5.0 - t * 0.48 + n * 1.6) * 0.048
        + fold * (0.012 + mids * 0.012);
      float wave = 0.5 + 0.5 * sin(x * 12.0 - t * 2.4 + n * 2.0);
      float width = 0.029 + activity * 0.019 + bass * (0.009 + wave * 0.013);
      float height = p.y - ridge;
      float curtain = smoothstep(-0.012, 0.012, height)
        * exp(-max(height, 0.0) / width * 2.1);
      float glow = exp(-pow(height / (width * 1.2), 2.0)) * 0.16;
      float filamentPhase = x * 115.0 + fold * 7.0 + height * 19.0 - t * (1.1 + n * 0.2);
      float fine = sin(filamentPhase) * sin(filamentPhase * 0.43 + n);
      float threads = 0.78 + fine * antialias * (0.16 + highs * 0.18);
      float crest = exp(-pow((height - 0.009) / 0.013, 2.0));
      float hue = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(x * 4.0 + n * 2.2 + t * 0.13 * chroma));
      vec3 base = mix(vec3(0.03, 0.95, 0.10), vec3(0.40, 0.04, 0.98), hue);
      vec3 fringe = mix(vec3(0.95, 0.02, 0.55), vec3(0.02, 0.50, 0.66), hue);
      vec3 color = mix(base, fringe, smoothstep(0.005, width * 1.8, height));
      // SURGE pulls the curtains back toward their green and violet bases.
      color = mix(color, base, surge * 0.5);
      color = mix(vec3(0.06, 0.19, 0.13), color, 0.45 + chroma * 0.55);
      float brightness = 0.30 + chroma * (colorEnergy * 0.40 + bass * wave * crest * 0.65) + surge * 0.45;
      light += vec4(color, 1.0) * (curtain * threads + glow) * brightness / (1.0 + n * 0.25);
    }
    return light * skyMask * (0.28 + chroma * 0.38);
  }
`;
