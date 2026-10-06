# Visualization Theme Authoring and Runtime Contract

This is the practical authoring guide for DeepSignals.FM visualization themes. It covers shared runtime conventions, not mandatory artistic choices. Source code remains authoritative; update this guide alongside shared infrastructure changes where practical.

Start with [src/themes/themeTypes.ts](../src/themes/themeTypes.ts) (`ThemeDefinition`, `ThemeSceneProps`) and [src/themes/themeRegistry.ts](../src/themes/themeRegistry.ts). A theme is a React scene component plus metadata, not an imperative plugin factory. For artwork and depth-map production, use the complementary [creating-image-environments.md](creating-image-environments.md).

## Choose an implementation and reference

Use the cheapest technology that fits the scene; Three.js is not inherently better.

| Class | Good fit | Canonical source and reason |
| --- | --- | --- |
| CSS/DOM | Static backgrounds, palette/filter changes; no renderer FPS | [src/themes/signal-gradient/SignalGradientTheme.tsx](../src/themes/signal-gradient/SignalGradientTheme.tsx): subscription-driven CSS CHROMA without a scene rAF. |
| Static baseline | Low-cost fallback; no audio or renderer loop | [src/themes/minimal/MinimalTheme.tsx](../src/themes/minimal/MinimalTheme.tsx): public dropdown name **Black**, internal id `minimal`. |
| Canvas2D | Glyphs, simple 2D particles/effects | [src/themes/signal-rain/SignalRainTheme.tsx](../src/themes/signal-rain/SignalRainTheme.tsx): bounded viewport columns, 30 Hz drawing, DPR, motion gating, real FPS. |
| Three.js travel | Spatial routes, camera movement, encounters | [src/themes/signal-tunnel/SignalTunnelTheme.tsx](../src/themes/signal-tunnel/SignalTunnelTheme.tsx): pooled instancing, resize/disposal, CHROMA, strict playback/MOTION freeze. |
| Spline ride | Shared world/camera path, eased propulsion and bursts | [src/themes/cosmic-roller-coaster/CosmicRollerCoasterTheme.tsx](../src/themes/cosmic-roller-coaster/CosmicRollerCoasterTheme.tsx): sustained-energy speed and shared SURGE qualification. See its freeze caveat below. |
| Image/depth | Artwork-based parallax | [src/themes/image-depth/ImageDepthThemeScene.tsx](../src/themes/image-depth/ImageDepthThemeScene.tsx): reuse the existing runtime and image-authoring guide rather than rebuilding it. |

For Tunnel's independently testable logic, inspect [src/themes/signal-tunnel/tunnelPath.ts](../src/themes/signal-tunnel/tunnelPath.ts) (centerline, clearance, sections/recycling) and [src/themes/signal-tunnel/tunnelMotion.ts](../src/themes/signal-tunnel/tunnelMotion.ts) (propulsion, animation clock, SURGE).

## Register and mount

1. Add a scene and an `index.ts` exporting a `ThemeDefinition`, following [src/themes/signal-tunnel/index.ts](../src/themes/signal-tunnel/index.ts). Declare a stable id, scoped class, performance tier, `Scene`, and meaningful capability flags.
2. Add the definition to `themeRegistry`. Image/depth definitions also use their catalog/presets; follow the image guide.
3. For public selection, update `PUBLIC_PLAYER_ENVIRONMENT_IDS` and `ENVIRONMENT_GROUPS` in [src/app/PlayerShell.tsx](../src/app/PlayerShell.tsx). Check optional name overrides and hidden ids. Registry membership alone does not expose an option.
4. PlayerShell persists selection, resolves `activeTheme`, and renders `<SceneComponent {...sceneProps} />`. Different component types unmount/mount through React; there is no universal keyed factory. Shared-component variants must handle identity changes explicitly.
5. Keep shell edits limited to integration. `defaultThemeId` is the registry fallback; `DEFAULT_PLAYER_THEME_ID` is the separate fresh-player default.

`supportsAudioReactiveBehavior` currently opts into PlayerShell's production Full On depth/hue/saturation overrides. It is **not** permission to read audio: Tunnel, Rain, and Gradient consume snapshots with this flag false. Inspect that shell branch before enabling it. `performanceTier` is metadata, not automatic quality scaling.

## Lifecycle and resource ownership

- **Mount:** Create canvas/DOM, scene, camera, renderer, reusable resources, and one owning animation effect. React owns Rain's canvas; Tunnel appends/removes its renderer canvas.
- **Receive state:** Copy live props/callbacks into a ref, as Tunnel/Rain do; read the ref inside the loop. Do not recreate a renderer on every audio/control update. Subscription-only scenes can return the unsubscribe function from their effect.
- **Resize:** Measure the scene container, guard dimensions with at least 1px, use `ResizeObserver`, and update projection and drawing-buffer size. Tunnel caps DPR at 1.7; Rain at 1.5 and reapplies its Canvas2D transform. These are examples, not universal quality requirements.
- **Update/render:** Bound frame delta (Tunnel/Coaster cap at 50ms), advance only eligible clocks, render, then sample FPS. Keep high-frequency mutable state outside React; throttle telemetry/UI updates.
- **Switch away:** Cancel rAF, disconnect observers, remove listeners, clear timers, unsubscribe, dispose the FPS sampler, and remove owned DOM. Dispose Three.js geometries, materials, textures, instanced-mesh resources, render targets, and renderer as applicable. Dispose shared resources once, by their owner; do not tear down the player's audio graph.
- **Check remounts:** StrictMode effect setup/cleanup must not accumulate loops, canvases, observers, or GPU resources. Async loaders must not attach resources or publish stale telemetry after disposal.

Minimal loop shape (pseudocode; scene-specific easing and drawing omitted):

```text
mount: allocate resources; observe size; schedule frame
frame:
	read live props and latest shared snapshot
	if isPlaying && motionEnabled && !reducedMotion: advance scene clocks
	update allowed color treatment; draw; sample render FPS
	schedule the next frame
unmount: cancel frame; unsubscribe/disconnect; dispose owned resources
```

## Player controls and motion

Preferences belong to PlayerShell. Themes consume them; they must not toggle user preferences when playback pauses or a scene changes.

| Input | Meaning and current convention |
| --- | --- |
| `isPlaying` | True only for controller status `playing`, not idle/loading/paused/error. Travel must not advance when false. |
| MOTION | Permits spatial/time progression. OFF freezes travel, geometry, encounters and travel-related effects; independent CHROMA may still respond. |
| CHROMA | OFF: stable/authored, restrained color and activity. ON: richer audio-responsive palette/brightness/pulses where appropriate. Never implies mandatory random rainbow cycling. |
| Reduced motion | Add `!reducedMotion` to kinetic eligibility. Tunnel/Rain freeze spatial progression; do not use the preference to silently change the MOTION checkbox. |
| INFO | Opens/closes the player-owned signal information/feed panel. It is not scene visibility, motion, or an analyser switch, and is not a `ThemeSceneProps` input. |
| Unsupported controls | Set capability flags honestly. [src/components/FloatingPlayerPanel.tsx](../src/components/FloatingPlayerPanel.tsx) leaves unsupported MOTION/CHROMA controls visible but disabled with a tooltip. |

[src/app/environmentRuntime.ts](../src/app/environmentRuntime.ts) exposes `deriveEnvironmentRuntime`: `effectiveMotion = isPlaying && motionEnabled`, preserving the snapshot unchanged. It does not include reduced motion and is not a mandatory scene wrapper; scenes currently gate their own loops.

For new travel themes, use `isPlaying && motionEnabled && !reducedMotion` for travel **and** encounter/SURGE animation clocks. A paused render loop can keep drawing frozen geometry for resizing or independent color response; it must not keep advancing the journey. Playing again resumes eligible movement without changing preferences.

Tunnel is the strict example: playback pause, MOTION OFF, and reduced motion freeze travel, waves, door opening, and decorative clocks. Rain freezes column/glyph/transmission progression but can still react chromatically. Gradient has no meaningful spatial motion. Audio-reactive color and motion need not share a clock, and CHROMA OFF need not remove all authored accent colors.

Deep Space Drift's [transitArchitecture.ts](../src/themes/alien-megastructure-transit/transitArchitecture.ts) uses slow, staggered cyan/lime/pink light sequences, with audio bands as secondary brightness accents. Ring LED chases, column light banks and bridge tiles share the existing `world.animationSeconds` clock: pause, MOTION OFF and reduced motion freeze their sequencing; mute stops propulsion but lets the lights continue while playback/MOTION remain enabled. CHROMA OFF hides the added LED mesh and retains the authored dark treatment and existing SURGE response. The additional lights use one bounded instanced mesh, not individual lights or a postprocessing pass.

Transit also recycles one hanging bridge billboard in **TUNE IN. / TRANSMIT. / TRANSCEND.** order through [transitSigns.ts](../src/themes/alien-megastructure-transit/transitSigns.ts). A full ring/columns/bridge sequence without signs alternates with a sequence containing just one sign under the bridge, starting without signs. The phrase advances when that bridge recycles; rings and columns carry no signs. One 1024x768 text atlas and two instanced draw calls cover the panel, hangers and text. TUNE IN. has a six-second bright-to-nearly-dark pulse; TRANSMIT. has irregular, softened light dips; TRANSCEND. has rounded 1.6-second pulses with a stronger glow peak every 6.4 seconds. All use the same frozen animation clock. CHROMA OFF retains the panel and hangers with steady dim, desaturated text instead of hiding the object. Textures are rendered at setup/font readiness, not every frame, and disposed on unmount. [transitSpace.ts](../src/themes/alien-megastructure-transit/transitSpace.ts) keeps 900 seeded stars in three draw calls, including 480 extra-faint stars in an irregular tilted band; only 14 stars use the brightest class. Normal CHROMA ON rendering totals 13 draw calls, or 15 during SURGE, with no new postprocessing or dynamic lights.

## Shared audio analysis and effective volume

The player owns one persistent media element in [src/app/usePersistentAudioController.ts](../src/app/usePersistentAudioController.ts). PlayerShell connects it to [src/app/useAudioAnalysis.ts](../src/app/useAudioAnalysis.ts), which owns/reuses the Web Audio graph, normalizes bands/RMS, smooths envelopes, handles onset warmup/seeking, and publishes snapshots. **Do not create a Web Audio graph or analyser per theme.**

Read `getLatestAudioSnapshot?.()` once per frame, or use `subscribeToAudioSnapshots` and unsubscribe on unmount. Treat snapshots as read-only. `audioLevel` currently arrives as `0` from PlayerShell; use the snapshot APIs, not that legacy field.

| Snapshot fields | Intended use |
| --- | --- |
| `energy`, `smoothedEnergy` | Normalized 0..1 energy; the latter has additional smoothing. Sustained propulsion/illumination. |
| `bass`, `mids`, `highs` | Normalized band envelopes for theme-specific emphasis. |
| `kickPulse`, `bassPulse`, `transient` | Short envelopes for accents; avoid making primary travel pump on every kick. |
| `kickPulseAcceptedEvent`, count, sequence | Qualified onset metadata; track sequence changes for one-shot consumers, not a nonzero envelope every frame. |
| `isActive` | Analysis availability/activity, not a substitute for playback status. |
| Optional stabilized-depth fields | Existing depth-family signals; see [src/app/playerTypes.ts](../src/app/playerTypes.ts). |

The analyser's `applyEnvelope` uses attack/release coefficients adjusted by frame duration, not rates to blindly copy as "per second." Theme-local target mapping and damping are appropriate: Coaster eases sustained energy into speed; Tunnel weights energy/smoothed energy/bass, normalizes, applies a quiet-signal curve, then damps speed. Clamp/validate inputs and keep musical spikes separate from comfortable locomotion.

**Main player volume:** the controller sets `HTMLAudioElement.volume`; the route is media source -> analyser -> destination. In this path, lower playback volume reduces the analysed signal. Do not multiply snapshots by the slider again. Tunnel's real-playback tests verify strong sound drives travel, very low volume strongly relaxes it, and mute settles speed to zero. That is a travel design, not a requirement to stop every non-travel effect at mute (Rain's falling speed is authored).

**Routing exception:** `configureGraphOutputRouting` supports `routeAudioThroughPostAnalyzerGain`, used by [src/experiments/reactivity-lab/ReactivityLabShell.tsx](../src/experiments/reactivity-lab/ReactivityLabShell.tsx). It fixes element volume at 1 and routes analyser -> listener gain -> destination, deliberately decoupling listening level from analysis. PlayerShell does not enable this mode. Verify the active route before introducing any volume bridge; avoid double attenuation.

Unavailable getter, inactive/invalid data, paused playback, and muted audio are distinct cases. Use safe finite neutral values; do not synthesize music or infer playback from residual smoothed energy. Travel should stop on playback state immediately even while analyser envelopes decay. Test actual bundled audio as well as synthetic snapshots.

## Shared SURGE qualification, local visuals

[src/app/sharedSurgeQualification.ts](../src/app/sharedSurgeQualification.ts) exports `createSharedSurgeQualificationState`, `updateSharedSurgeQualification`, and `mapEnergyToSurgeTargetSpeed`. There is currently no generic `energySurge` field on the snapshot: themes own qualifier state and consume its result.

- The mapper normalizes energy from 0.04..0.72 to a 0..100 qualification scale. This is not a required world-speed unit.
- Arming requires mapped energy at or below 68 for 400ms; a rise to at least 99 triggers only when armed and outside the 1500ms cooldown. Consult the exported constants rather than copying them into themes.
- Triggering disarms the state. Sustained high energy cannot retrigger every frame; another low-energy arm and cooldown are required. Disabling playback/motion resets arming when the helper receives those gates.
- Pass accepted-event sequence metadata, playback/motion gates, energy, and a consistent millisecond clock; retain the returned state. Sequence metadata is recorded, but this helper triggers from energy hysteresis, not exclusively from a new kick event. Apply reduced-motion eligibility before launching an effect.
- Own a bounded local envelope/pool for speed-ceiling unlocks, streaks, wavefronts, geometry illumination, or chamber accents. These visuals are optional and theme-specific.

For strict freeze, follow Tunnel's paused simulation clock. Keep qualification time separate from energy-scaled decorative time: slowing the qualification clock with quiet energy can prevent its arming hold from completing as intended. Freeze event progression deliberately; merely setting target travel speed to zero does not freeze an effect.

[src/app/sharedChroma.ts](../src/app/sharedChroma.ts) provides `mapSmoothedEnergyToHue` and `applyChromaHueResponse` when a hue-response mapping fits. It is not mandatory for every palette: Tunnel uses coherent color interpolation and Gradient maps bands to CSS filters. Reuse signals/helpers, not a compulsory visual style.

## Honest FPS telemetry

Use `createRenderFpsSampler` from [src/app/renderFpsTelemetry.ts](../src/app/renderFpsTelemetry.ts); it owns no loop. Sample once per actual draw, not once per browser callback if drawing is throttled. It aggregates approximately one-second windows and resets after long frame gaps; these are render-loop observations, not GPU-completion timing or a benchmark.

| Scene | Report |
| --- | --- |
| Three.js | Sample after `renderer.render(scene, camera)`, as Tunnel/Coaster do. |
| Canvas2D | Sample only frames actually drawn, as Rain does after its 30 Hz throttle. |
| CSS/static/subscription-only | Omit `renderFps`; Black/Gradient correctly show unavailable (`---`). Audio subscription frequency is not FPS. |

Publish via `onRuntimeTelemetry`. PlayerShell tags displayed FPS by selected theme, clears it in `handleThemeChange` and when hidden, and rejects callbacks for the wrong theme or hidden page. Dispose the sampler and stop callbacks on unmount; do not publish a fake zero/60 to clear the display. A frozen scene that still renders can legitimately report FPS. Creating an unrelated rAF just to populate FPS is incorrect.

## Performance and travel design

- Bound object counts. Recycle sections and pool transient effects; use instancing for repeated structures and reuse geometries/materials. Tunnel's segment pool, chamber markers, doors, and waves are an example, not mandatory pool sizes.
- Reuse vectors, matrices, colors, and typed buffers in hot loops. Avoid new meshes/materials and allocation storms per frame, unbounded particles, or hundreds/thousands of separate draw calls.
- Bound DPR, inspect actual desktop/mobile render cost, and avoid unnecessary shadows, dynamic lights, and postprocessing. Add expensive effects only after measuring a working scene; dispose their resources explicitly.
- Derive camera, corridor/world geometry, and clearance from the same spatial model where practical. Tunnel uses one centerline; Coaster builds its ride around one spline. Check clearance at maximum speed and after recycling, not just in a still screenshot.

Build ambitious travel scenes in testable phases:

1. Greybox camera/path movement, safe clearance, recycling, resize, and basic FPS.
2. Structural variation, sections/chambers, and audio propulsion.
3. CHROMA, shared qualified events, and theme-specific spectacle.
4. Visual polish, optional postprocessing, and measured performance tuning.

Do not build the elaborate world before proving movement. Keep changes local rather than rewriting stable shell/shared infrastructure for one visual effect.

## Verification references

Use [tests/support/test.ts](../tests/support/test.ts) for Playwright fixtures/error capture and [src/app/runtimeTestBridge.ts](../src/app/runtimeTestBridge.ts) for existing runtime diagnostics. Prefer bounded-state, control, lifecycle, and geometric assertions over brittle exact Three.js screenshots.

- [tests/behavior/signal-tunnel.spec.ts](../tests/behavior/signal-tunnel.spec.ts): pure path/motion/SURGE tests, door clearance, bounded pools, real audio volume, frozen canvases, desktop/mobile captures, switching and FPS cleanup.
- [tests/behavior/signal-runner-2.spec.ts](../tests/behavior/signal-runner-2.spec.ts): independent sibling selection/persistence, seeded encounters, swept clearance, reusable render buffers, shared/real-audio SURGE, freeze gates, CHROMA captures and GPU/observer/RAF cleanup.
- [tests/behavior/signal-rain.spec.ts](../tests/behavior/signal-rain.spec.ts) and [tests/behavior/signal-gradient.spec.ts](../tests/behavior/signal-gradient.spec.ts): Canvas2D versus DOM controls, subscriptions, and renderer availability.
- [tests/behavior/surge-qualification.spec.ts](../tests/behavior/surge-qualification.spec.ts) and [tests/behavior/volume-surge.spec.ts](../tests/behavior/volume-surge.spec.ts): shared arming/cooldown and real-audio integration.
- [tests/smoke/player.spec.ts](../tests/smoke/player.spec.ts): selector, controls, playback and environment switching. [scripts/test-environment-runtime.ts](../scripts/test-environment-runtime.ts): shared runtime-policy checks.

For freeze checks, sample the canvas directly in rAF using a small offscreen Canvas2D and compare hashes, as Tunnel's `canvasPixels` does. A screenshot of a full-screen canvas can include independently animated player overlays. Use screenshots separately to inspect framing, appearance and mobile overlap; avoid huge binary equality diffs.

[playwright.config.ts](../playwright.config.ts) builds and runs Vite preview at port 4173 by default, reusing a server outside CI. Ensure a reused preview serves a current build. Install Chromium once with `npx playwright install chromium`. Typical commands (choose the relevant specs):

```sh
npm run test:runtime
npx playwright test tests/behavior/signal-tunnel.spec.ts
npx playwright test tests/smoke/player.spec.ts
npm run build
npm run lint
```

## Current differences to keep visible

- **Asteroid Runner** is an independent travel scene (`signal-runner-2`), not a replacement for `signal-runner`. Its [journey runtime](../src/themes/signal-runner-2/runnerJourney.ts) preserves three recycled region slots and open/asteroid/gate pacing. Each extended asteroid field has three spaced bypasses, including one hero boulder, around the rocks' full tumbling spheres; the camera translates along that path, looks 38 units ahead and banks no more than 0.065 radians. The route returns to baseline before gate regions. Rocks share a [fractured geometry and natural material](../src/themes/signal-runner-2/runnerRock.ts); CHROMA changes localized rims/seams, not whole-rock colors.

  [Gate encounters](../src/themes/signal-runner-2/runnerGates.ts) mix lobed mechanical rings, slimmer energy portals and occasional five-rib transit sleeves. Two widely separated gates (240–290 world units apart) are the usual encounter; every third gate region has a three-gate cluster with one 32–44-unit open-sided sleeve. Diameter, axial thickness, rotation and accent are seeded in nine reusable encounter records; every fourth gate region opens with a 46–52-unit hero aperture. Sleeves are less than 0.56 seconds long at the normal speed ceiling, not a continuous tunnel. Slowly counter-rotating inner arcs and a soft procedural membrane use the frozen animation clock. Shared music activity and kick envelopes add bounded breathing/brightness (soft attack, longer release), without a new analyser or new SURGE effect. CHROMA OFF suppresses these music accents; membranes fade out before crossing to avoid a full-screen flash.

  The [renderer](../src/themes/signal-runner-2/runnerSpace.ts) retains 900 stars, three SURGE rings and capacity for 108 rocks. Gate render capacities are 96 shell segments, 15 collars, 72 machinery pieces, 168 panels, 45 arc fragments and three membrane planes, culled to nearby encounters. Six instanced draws cover all gate families, only two more than the earlier gates; there are 14 drawable objects total. One pooled crossing ship with colorful bounded exhaust appears every eight regions, only in open space. No textures/loaders, postprocessing, added lights or extra animation loops; transparent membranes and rings use a single pass.

  Sustained energy drives eased propulsion without a second volume multiplier: normal ceiling 80 world units/second, SURGE ceiling 240. Shared qualification is unchanged, running at 20 Hz on a paused simulation clock with the existing 3.2-second local envelope. Pause, MOTION OFF and reduced motion freeze travel, bands, navigation, tumbling, gate arcs/membranes/music envelopes, traffic and active SURGE visuals, and reset qualifier arming; CHROMA can still be toggled. Quiet/inactive analysis eases propulsion to zero. DPR remains capped at 1.7 and FPS is sampled after actual draws.

- Coaster gates ride progress, gate rotation and tunnel-light progression, but active SURGE streaks/envelope and portal residue still advance outside that gate. Do not copy it as an all-effects-freeze implementation; use Tunnel. Unifying this behavior is a separate runtime change.
- PlayerShell reads `matchMedia(...).matches` while rendering; it does not subscribe specifically to reduced-motion preference changes. Existing tests emulate the preference before reload. Immediate live OS-preference updates need separate clarification/work.
- Black's [src/themes/minimal/index.ts](../src/themes/minimal/index.ts) currently declares `supportsChroma: true`, although its static scene ignores CHROMA. That legacy no-op is not a pattern for new unsupported controls.
- `supportsAudioReactiveBehavior` has the narrower Full On meaning described above. `supportsVisualFeed` exists in metadata, but current PlayerShell INFO rendering does not gate on it; do not assume it suppresses the panel.
- Older inventory/volume descriptions in [README.md](../README.md) predate current scenes and routing verification. Use the source references here, not old environment counts or claims that main-player snapshots always ignore volume.

## New-theme checklist

### Before coding
- [ ] Read this guide and the closest canonical implementation.
- [ ] Choose CSS/DOM, Canvas2D, Three.js, or existing image/depth runtime.
- [ ] Specify meaningful controls, playback/quiet fallback, audio needs, and FPS semantics.
- [ ] For travel, prove the path/camera and clearance before visual expansion.

### Implementation
- [ ] Register metadata and public allowlist/group entry when appropriate.
- [ ] Follow scene ownership; keep one loop/subscription and stable resource initialization.
- [ ] Reuse shared audio; separate sustained movement from beat accents.
- [ ] Gate travel, encounters, SURGE clocks and reduced motion deliberately.
- [ ] Make CHROMA ON/OFF coherent; preserve independent control preferences.
- [ ] Bound pools/DPR and handle resize; dispose resources, timers, listeners and telemetry.
- [ ] Report actual draws only, or leave FPS unavailable.

### Verification
- [ ] Check selector, mount, repeated switch-away/back, and no duplicate canvases/loops/errors.
- [ ] Review desktop and narrow/mobile framing, resize, assets and nonblank rendering.
- [ ] Test play/pause, energetic/quiet audio, low volume/mute, and unavailable analysis if reactive.
- [ ] Test CHROMA, MOTION, reduced motion, INFO independence and FPS clearing.
- [ ] Test pool bounds, path/door clearance and SURGE arm/cooldown/freeze if applicable.
- [ ] Run focused logic tests and relevant player Playwright specs; inspect screenshots manually.
- [ ] Run production build and lint; report results and any unverified behavior.
