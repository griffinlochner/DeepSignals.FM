// Shared directional radiance: no screen-space overlay or separate reflection pass.
export const twilightAuroraShader = /* glsl */`
  uniform float auroraBass;
  uniform float auroraMids;
  uniform float auroraHighs;

  vec4 auroraLight(vec3 d, float sunAngle, float alienAngle) {
    vec2 p = d.xy / max(0.2, -d.z);
    // Derivatives must be outside divergent branches and the ribbon loop.
    float antialias = 1.0 - smoothstep(0.5, 2.5, fwidth(p.x) * 171.0 + fwidth(p.y) * 19.0);
    if (p.y < 0.16 || p.y > 0.46 || d.z > -0.2) return vec4(0.0);
    float skyMask = smoothstep(0.16, 0.23, p.y) * (1.0 - smoothstep(0.35, 0.46, p.y));
    skyMask *= 1.0 - smoothstep(0.65, 1.25, abs(p.x));
    // Leave breathing room around the suns, including their atmospheric halos.
    skyMask *= smoothstep(0.04, 0.09, sunAngle) * smoothstep(0.065, 0.12, alienAngle);
    if (skyMask <= 0.0) return vec4(0.0);
    float bass = auroraBass * chroma;
    float mids = auroraMids * chroma;
    float highs = auroraHighs * chroma;
    float activity = waterEnergy * chroma;
    float t = skyTime * 0.85;
    vec4 light = vec4(0.0);
    for (int layer = 0; layer < 3; layer++) {
      float n = float(layer);
      float x = p.x + n * 0.21;
      float fold = sin(x * 8.0 + t * 0.65 + n * 1.7);
      float ridge = 0.225 + n * 0.032 + p.x * 0.055
        + sin(x * 6.0 - t * 0.48 + n * 1.6) * 0.043
        + fold * (0.010 + mids * 0.009);
      float wave = 0.5 + 0.5 * sin(x * 12.0 - t * 2.4 + n * 2.0);
      float width = 0.027 + activity * 0.026 + bass * (0.009 + wave * 0.013);
      float height = p.y - ridge;
      float curtain = smoothstep(-0.012, 0.012, height)
        * exp(-max(height, 0.0) / width * 1.7);
      float glow = exp(-pow(height / (width * 1.2), 2.0)) * 0.16;
      float filamentPhase = x * 115.0 + fold * 7.0 + height * 19.0 - t * (1.1 + n * 0.2);
      float fine = sin(filamentPhase) * sin(filamentPhase * 0.43 + n);
      float threads = 0.78 + fine * antialias * (0.16 + highs * 0.18);
      float crest = exp(-pow((height - 0.009) / 0.013, 2.0));
      float hue = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(x * 4.0 + n * 2.2 + t * 0.13 * chroma));
      vec3 base = mix(vec3(0.008, 0.85, 0.22), vec3(0.018, 0.18, 0.95), hue);
      vec3 fringe = mix(vec3(0.38, 0.008, 0.85), vec3(0.95, 0.012, 0.25), hue);
      vec3 color = mix(base, fringe, smoothstep(0.005, width * 1.8, height));
      color = mix(color, color * 0.82 + cloudLightColor * 0.18, 0.35);
      color = mix(vec3(0.12, 0.24, 0.30), color, 0.35 + chroma * 0.65);
      float brightness = 0.28 + chroma * (colorEnergy * 0.55 + bass * wave * crest * 0.65);
      light += vec4(color, 1.0) * (curtain * threads + glow) * brightness / (1.0 + n * 0.25);
    }
    return light * skyMask * (0.38 + chroma * 0.62);
  }
`;
