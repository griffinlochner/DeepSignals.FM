import { TOXIC_VOLCANO } from "./toxicRuntime";

const glsl = (value: number) => value.toFixed(4);

// A directional mountain with no geometry: silhouette, fissures, plume, fire, ejecta, embers and
// lightning are all one analytic layer. The visible sky evaluates it per fragment; the water mirrors
// the very same layer from a small per-frame bake, so reflections stay coherent.
// v is the horizon tangent plane centred on the volcano and divided by its viewport scale.
export const toxicVolcanoShader = /* glsl */`
  uniform float magmaTime;
  uniform float fissureGlow;
  uniform float moltenPulse;
  uniform float moltenTrail;
  uniform float sparkEnergy;
  uniform float eruption;
  uniform float eruptionAge;
  uniform float eruptionPressure;
  uniform float eruptionFountain;
  uniform float eruptionFlare;
  uniform float eruptionFront;
  uniform float eruptionLightning;
  uniform vec2 eruptionSeed;

  const vec2 TOXIC_CRATER = vec2(0.0, ${glsl(TOXIC_VOLCANO.craterHeight)});
  const float TOXIC_PEAK = ${glsl(TOXIC_VOLCANO.peakHeight)};
  const float TOXIC_LEFT_BASE = ${glsl(TOXIC_VOLCANO.leftBase)};
  const float TOXIC_RIGHT_BASE = ${glsl(TOXIC_VOLCANO.rightBase)};
  const float TOXIC_CRATER_HALF = 0.034;

  // Trig-free hash: this runs many times per fragment in both the sky and the reflection.
  float toxicHash(float n) {
    n = fract(n * 0.1031 + 0.137);
    n *= n + 33.33;
    n *= n + n;
    return fract(n);
  }
  // Piecewise-linear on purpose: kinks read as rock ridgelines and lightning joints.
  float kinkNoise(float x) {
    float cell = floor(x);
    return mix(toxicHash(cell), toxicHash(cell + 1.0), x - cell);
  }
  vec3 toxicEmber() {
    return mix(vec3(0.80, 0.19, 0.035), vec3(1.25, 0.34, 0.05), chroma);
  }
  vec3 toxicMagma() {
    return mix(vec3(0.22, 0.022, 0.42), vec3(0.85, 0.05, 0.95), chroma);
  }
  float toxicCraterHeat() {
    return 0.5 + chroma * (colorEnergy * 0.3 + moltenPulse * 0.55) + eruptionPressure * (0.6 + chroma * 0.9);
  }

  float volcanoShoulder(float x, float center, float halfWidth, float height, float jag) {
    float t = max(0.0, 1.0 - abs(x - center) / halfWidth);
    float peak = height * t * sqrt(t);
    return peak + jag * smoothstep(0.0, 0.02, peak);
  }
  float volcanoRidge(float x) {
    float u = abs(x);
    float side = x < 0.0 ? TOXIC_LEFT_BASE : TOXIC_RIGHT_BASE;
    float t = clamp((u - TOXIC_CRATER_HALF) / (side - TOXIC_CRATER_HALF), 0.0, 1.0);
    float cone = TOXIC_PEAK * pow(1.0 - t, 1.9);
    float jag = (kinkNoise(x * 23.0 + 3.1) - 0.5) * 0.030
      + (kinkNoise(x * 61.0 + 9.7) - 0.5) * 0.014
      + (kinkNoise(x * 147.0 + 4.3) - 0.5) * 0.004;
    float ridge = cone + jag * smoothstep(0.04, 0.13, u) * smoothstep(0.0, 0.035, cone);
    // Uneven crater lips around a shallow bowl.
    ridge += 0.011 * max(0.0, 1.0 - abs(x + 0.036) / 0.022) + 0.006 * max(0.0, 1.0 - abs(x - 0.038) / 0.02);
    ridge -= 0.015 * (1.0 - smoothstep(0.004, 0.032, u));
    ridge = max(ridge, volcanoShoulder(x, -0.215, 0.085, 0.120, jag * 0.7));
    ridge = max(ridge, volcanoShoulder(x, 0.30, 0.12, 0.092, jag * 0.7));
    ridge = max(ridge, volcanoShoulder(x, -0.43, 0.13, 0.050, jag * 0.5));
    ridge = max(ridge, volcanoShoulder(x, 0.52, 0.15, 0.040, jag * 0.5));
    return max(ridge, 0.0);
  }
  float volcanoFarRidge(float x) {
    float n = kinkNoise(x * 8.0 + 40.0) * 0.6 + kinkNoise(x * 25.0 + 11.0) * 0.28 + kinkNoise(x * 67.0 + 5.0) * 0.12;
    return (0.008 + 0.078 * n * n) * (1.0 - smoothstep(0.5, 1.05, abs(x - 0.04)));
  }

  // s follows the cone's fall lines, so channels radiate from the crater and widen downhill.
  // Returns the molten core, its soft halo and a per-channel id.
  vec3 magmaChannel(float s, float depth, float halfWidth, float pixel, float cells, float seed) {
    float c = s * cells;
    float cell = floor(c);
    float f = c - cell;
    float id = toxicHash(cell * 1.37 + seed);
    // Each channel zig-zags inside its own fall-line cell, like a crack rather than a ribbon.
    float center = 0.5 + ((kinkNoise(depth * 13.0 + id * 53.0) - 0.5) * 0.46
      + (kinkNoise(depth * 37.0 + id * 91.0) - 0.5) * 0.16) * smoothstep(0.0, 0.2, depth);
    float dist = abs(f - center) * halfWidth / cells;
    float reach = 0.30 + 0.70 * toxicHash(cell * 3.3 + seed + 9.0);
    // Fall lines only exist on the cone itself, not on the shoulder peaks beside it.
    float alive = step(0.22, id) * (1.0 - smoothstep(reach - 0.22, reach, depth)) * (1.0 - smoothstep(0.95, 1.08, abs(s)));
    float width = 0.0006 + 0.0010 * depth;
    float soft = max(pixel, 0.0003);
    // Subpixel channels (mostly in rippled reflections) fade to their mean instead of shimmering.
    float core = (1.0 - smoothstep(width, width + soft * 1.5, dist)) * min(1.0, width * 2.0 / soft);
    float halo = exp(-dist / (width * 3.0 + soft)) * smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.88, 1.0, f));
    float flow = 0.62 + 0.38 * sin(depth * 52.0 - magmaTime * 1.7 + id * 40.0);
    return vec3(core * alive * flow, halo * alive * flow, id);
  }
  vec3 magmaTint(float id, float depth) {
    vec3 lively = mix(vec3(0.50, 0.06, 1.25), vec3(1.30, 0.07, 0.62), smoothstep(0.25, 0.62, id));
    lively = mix(lively, vec3(1.35, 0.30, 0.04), step(0.74, id));
    // CHROMA OFF keeps one authored deep purple instead of per-channel colour.
    vec3 tint = mix(vec3(0.27, 0.026, 0.52), lively, chroma);
    return mix(tint, toxicEmber() * 1.15, exp(-depth * 9.0) * 0.7);
  }

  float toxicBolt(vec2 rel, float angle, float len, float seed, float pixel) {
    vec2 direction = vec2(sin(angle), cos(angle));
    float along = dot(rel, direction) / len;
    if (along < 0.0 || along > 1.0) return 0.0;
    float across = dot(rel, vec2(direction.y, -direction.x));
    float offset = ((kinkNoise(along * 6.0 + seed * 13.7) - 0.5) * 0.22
      + (kinkNoise(along * 17.0 + seed * 29.3) - 0.5) * 0.08) * len * min(1.0, along * 5.0);
    float dist = abs(across - offset);
    float radius = max(0.0011, pixel);
    float core = radius * radius / (radius * radius + dist * dist);
    float halo = 0.0035 / (dist + 0.0035);
    return (core * core * core * min(1.0, 0.0017 / radius) + halo * halo * 0.16) * smoothstep(0.0, 0.04, along) * (1.0 - smoothstep(0.7, 1.0, along));
  }

  vec4 toxicOver(vec4 layer, vec3 radiance, float opacity) {
    return vec4(layer.rgb * (1.0 - opacity) + radiance * opacity, layer.a * (1.0 - opacity));
  }

  // The volcano as one layer: premultiplied radiance in rgb, transmittance of the sky behind it in a.
  // Each feature is confined to its own small region so most fragments skip most of the work.
  vec4 toxicVolcano(vec2 v, float pixel, vec4 billow, vec4 wisp, vec4 flicker, vec3 mist, float eruptionVisibility) {
    vec4 layer = vec4(0.0, 0.0, 0.0, 1.0);
    vec2 q = v - TOXIC_CRATER;
    vec3 ember = toxicEmber();
    vec3 magma = toxicMagma();
    float heat = toxicCraterHeat();
    float vivid = 0.4 + chroma * 0.6;
    float rise = max(q.y, 0.0);
    float lean = rise * (0.16 + rise * 0.55);

    if (q.y > -0.2 && q.y < 0.54 && abs(q.x - lean) < max(0.30 - rise, 0.03 + rise * 0.57)) {
      // Smoke plume, lit from within near the crater; drawn behind the mountain.
      float spread = 0.030 + rise * (0.42 + eruptionFountain * 0.15);
      float column = 1.0 - smoothstep(0.35, 1.0, abs(q.x - lean) / spread);
      float density = column
        * smoothstep(0.26, 0.60, billow.r * 0.62 + wisp.g * 0.38 + column * 0.22 - rise * (0.75 - eruptionFountain * 0.35))
        * smoothstep(-0.012, 0.015, q.y) * (1.0 - smoothstep(0.34, 0.52, rise));
      vec3 smoke = vec3(0.020, 0.013, 0.030) * (0.6 + wisp.r);
      smoke += ember * exp(-rise * 22.0) * heat * 0.22 * (0.35 + billow.g);
      smoke += magma * exp(-rise * 6.0) * 0.03 * (0.4 + billow.r);
      // The fountain lights the billows from within: saturated ember red, never a white flash.
      smoke += (ember * 0.42 + magma * 0.10) * eruptionFountain * eruptionVisibility * exp(-rise * 5.0) * (0.25 + billow.g * 1.1);
      smoke += vec3(0.42, 0.36, 0.95) * eruptionLightning * eruptionVisibility * vivid * 0.22 * (0.4 + billow.g);
      layer = toxicOver(layer, smoke, density * 0.88);

      float glowDistance = length(q * vec2(1.0, 1.25));
      layer.rgb += ember * heat * (exp(-glowDistance * glowDistance / 0.0011) * 0.9 + exp(-glowDistance / 0.035) * 0.10);
      layer.rgb += magma * heat * exp(-glowDistance / 0.09) * 0.05;

      // One flame shape: a restrained ambient flicker that the eruption stretches into a fountain.
      float fountainHeight = 0.020 + chroma * (colorEnergy * 0.010 + moltenPulse * 0.006) + eruptionFountain * 0.24;
      float fy = q.y / fountainHeight;
      if (fy > -0.3 && fy < 1.2 && abs(q.x) < 0.16) {
        float climb = clamp(fy, 0.0, 1.0);
        float fireWidth = (0.011 + eruptionFountain * 0.020) * (0.6 + climb * 1.5);
        float sway = (flicker.r - 0.5) * fireWidth * 1.6 * climb;
        float fx = abs(q.x - sway - lean * 0.4) / fireWidth + (flicker.b - 0.5) * 0.5 * climb;
        float tongue = (1.0 - smoothstep(0.2, 1.0, fx))
          * (1.0 - smoothstep(0.35, 1.0, fy + (flicker.g - 0.5) * 0.9)) * smoothstep(-0.25, 0.1, fy);
        float hot = tongue * (1.0 - smoothstep(0.0, 0.6, fx)) * (1.0 - smoothstep(0.0, 0.55, fy));
        // Molten orange body, magma-purple tips and edges, a small white-hot core at the vent.
        vec3 fire = mix(magma * 1.2, ember * 1.15, smoothstep(0.15, 0.75, tongue * (1.0 - climb * 0.55)));
        fire = mix(fire, vec3(1.5, 1.05, 0.42), hot * hot * (0.4 + chroma * 0.4));
        layer.rgb += fire * tongue * (0.5 + 0.7 * flicker.a) * (0.6 + eruptionFountain * 0.7)
          * mix(1.0, eruptionVisibility, eruptionFountain) * vivid;
      }
    }

    float aa = max(pixel * 1.5, 0.00003);
    float low = exp(-max(v.y, 0.0) / 0.012);
    if (v.y < 0.1 + aa) {
      float farCover = smoothstep(-aa, aa, volcanoFarRidge(v.x) - v.y);
      layer = toxicOver(layer, mix(vec3(0.010, 0.005, 0.018), mist, 0.25 + low * 0.7), farCover);
    }

    float edge = -1.0;
    if (v.y < 0.21 + aa && abs(v.x) < 0.7) edge = volcanoRidge(v.x) - v.y;
    float cover = smoothstep(-aa, aa, edge);
    if (cover > 0.0) {
      float depth = clamp(1.0 - v.y / TOXIC_PEAK, 0.0, 1.0);
      float side = v.x < 0.0 ? TOXIC_LEFT_BASE : TOXIC_RIGHT_BASE;
      float halfWidth = TOXIC_CRATER_HALF + (1.0 - pow(1.0 - depth, 1.0 / 1.9)) * (side - TOXIC_CRATER_HALF);
      float s = v.x / halfWidth;
      vec3 major = magmaChannel(s, depth, halfWidth, pixel, 7.0, 3.0);
      vec3 minor = magmaChannel(s, depth, halfWidth, pixel, 15.0, 21.0);
      minor.xy *= smoothstep(0.18, 0.5, depth) * 0.6;
      // Kick: a fast pulse at the crater lips and a slower echo further down the fissures.
      float echo = (depth - 0.32) / 0.2;
      float pulse = chroma * (moltenPulse * exp(-depth * 7.0) * 1.6 + moltenTrail * exp(-echo * echo) * 0.7);
      // SURGE: the flare front travels from the crater down to the sea.
      float front = (depth - eruptionFront) / 0.2;
      float flare = eruptionFlare * (0.5 + 2.2 * exp(-front * front)) * vivid;
      float glow = (0.55 + chroma * (fissureGlow * 0.8 + colorEnergy * 0.25) + pulse + flare) * (1.0 - 0.55 * depth);
      float strata = kinkNoise(s * 29.0 + depth * 2.0) * 0.6 + kinkNoise(s * 71.0 - depth * 5.0) * 0.4;
      vec3 rock = vec3(0.007, 0.006, 0.013) * (0.35 + 1.3 * strata);
      rock += ember * heat * 0.022 * exp(-depth * 6.0) * (0.4 + strata);
      rock += vec3(0.045, 0.012, 0.085) * (1.0 - smoothstep(0.0, 0.004 + pixel * 2.0, edge)) * (0.6 + chroma * colorEnergy);
      rock += vec3(0.30, 0.26, 0.62) * eruptionLightning * eruptionVisibility * vivid * 0.05 * (0.3 + strata);
      rock += magmaTint(major.z, depth) * (major.x * 2.6 + major.y * 0.12) * glow;
      rock += magmaTint(minor.z, depth) * (minor.x * 1.8 + minor.y * 0.06) * glow;
      float lip = depth / 0.035;
      rock += ember * heat * exp(-lip * lip) * (1.0 - smoothstep(0.03, 0.06, abs(v.x))) * 0.8;
      // Sea mist at the foot matches the far water's horizon blend: no seam where they meet.
      rock = mix(rock, mist, low * 0.95);
      layer = toxicOver(layer, rock, cover);
    }

    // Bounded analytic lava fragments: ballistic arcs with short trails, gone before the event ends.
    if (eruption > 0.0 && abs(q.x) < 0.5 && q.y > -0.25 && q.y < 0.3) {
      vec3 sparks = vec3(0.0);
      for (int i = 0; i < TOXIC_EJECTA; i++) {
        float n = float(i) + eruptionSeed.x * 19.0;
        float t = eruptionAge - 0.42 - toxicHash(n * 3.1) * 0.5;
        if (t <= 0.0 || t >= 1.5) continue;
        vec2 velocity = normalize(vec2((toxicHash(n * 5.3 + 2.0) - 0.5) * 2.4, 1.0)) * (0.30 + toxicHash(n * 7.7 + 5.0) * 0.13);
        vec2 head = velocity * t - vec2(0.0, 0.25 * t * t);
        float tb = max(t - 0.075, 0.0);
        vec2 tail = velocity * tb - vec2(0.0, 0.25 * tb * tb);
        vec2 line = head - tail;
        float along = clamp(dot(q - tail, line) / max(dot(line, line), 0.00000001), 0.0, 1.0);
        vec2 away = q - tail - line * along;
        float distSquared = dot(away, away);
        float radius = max(0.003, pixel);
        // Rational falloffs: this loop is the eruption's hot path.
        float core = radius * radius / (radius * radius + distSquared);
        float halo = 0.000144 / (0.000144 + distSquared);
        float spark = core * core * core * (0.35 + 0.65 * along) * min(1.0, 0.0045 / radius) + 0.10 * halo * halo * along;
        float cooling = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.5, t));
        sparks += mix(ember * 1.6, magma * 1.5, step(0.55, toxicHash(n * 11.3 + 7.0)) * chroma) * spark * cooling;
      }
      layer.rgb += sparks * (1.0 - smoothstep(2.55, 3.05, eruptionAge)) * eruptionVisibility * vivid * 2.4;
    }

    // Occasional ambient embers: six reused slots, each replayed with a new seeded drift.
    if (q.y > -0.01 && q.y < 0.2 && abs(q.x) < 0.14) {
      float embers = 0.0;
      for (int i = 0; i < 6; i++) {
        float n = float(i);
        float cycle = magmaTime / (2.4 + toxicHash(n * 9.1 + 1.0) * 2.6) + toxicHash(n * 4.7 + 2.0);
        float phase = fract(cycle);
        float seed = mod(floor(cycle), 97.0) + n * 17.0;
        float drift = toxicHash(seed * 1.3);
        vec2 position = vec2(
          (drift - 0.5) * 0.04 + phase * (0.02 + 0.05 * fract(drift * 7.3)) + sin(phase * 7.0 + seed) * 0.006,
          phase * (0.06 + 0.09 * fract(drift * 13.7)));
        float radius = max(0.0016, pixel);
        vec2 away = q - position;
        float glow = radius * radius / (radius * radius + dot(away, away));
        embers += glow * glow * glow * min(1.0, 0.0024 / radius) * 4.0 * phase * (1.0 - phase);
      }
      layer.rgb += ember * embers * (0.5 + chroma * sparkEnergy * 2.0) * 1.5;
    }

    // Three analytic forked bolts per flash, radiating from the plume.
    if (eruptionLightning > 0.0 && abs(q.x - 0.05) < 0.42 && q.y > -0.08 && q.y < 0.44) {
      float flashSeed = eruptionSeed.x * 3.0 + eruptionSeed.y;
      float bolts = 0.0;
      for (int i = 0; i < 3; i++) {
        float n = float(i) + flashSeed * 7.0;
        float h = toxicHash(n * 2.3);
        float up = 0.03 + 0.085 * float(i) + 0.03 * h;
        vec2 rel = q - vec2(up * (0.16 + up * 0.55) + (h - 0.5) * 0.03, up);
        float turn = mod(float(i) + eruptionSeed.y, 2.0) < 0.5 ? -1.0 : 1.0;
        float angle = turn * (0.55 + 0.95 * toxicHash(n * 5.9 + 1.0));
        float len = 0.11 + 0.09 * toxicHash(n * 8.3 + 2.0);
        bolts += toxicBolt(rel, angle, len, n, pixel);
        bolts += 0.6 * toxicBolt(rel - vec2(sin(angle), cos(angle)) * len * 0.42, angle + turn * 0.75, len * 0.5, n + 31.0, pixel);
      }
      layer.rgb += mix(vec3(0.50, 0.46, 0.78), vec3(0.62, 0.52, 1.55), chroma) * bolts
        * eruptionLightning * eruptionVisibility * vivid * 3.0;
    }
    return layer;
  }

  // The layer's bounds in volcano units; the reflection bake covers exactly this rectangle.
  const vec2 TOXIC_VOLCANO_EXTENT = vec2(1.1, 0.74);

  vec4 toxicVolcanoLayer(vec2 v, float pixel, vec3 mist, float eruptionVisibility) {
    vec2 q = v - TOXIC_CRATER;
    // Filtered lookups stay outside the divergent bounds test.
    vec4 billow = texture2D(noiseMap, vec2(q.x * 3.1, q.y * 2.4 - magmaTime * 0.085));
    vec4 wisp = texture2D(noiseMap, vec2(q.x * 7.3 + 0.37, q.y * 6.1 - magmaTime * 0.19));
    vec4 flicker = texture2D(noiseMap, vec2(q.x * 14.0, q.y * 7.0 - magmaTime * 0.55));
    if (abs(v.x) >= TOXIC_VOLCANO_EXTENT.x || v.y >= TOXIC_VOLCANO_EXTENT.y) return vec4(0.0, 0.0, 0.0, 1.0);
    return toxicVolcano(v, pixel, billow, wisp, flicker, mist, eruptionVisibility);
  }
`;
