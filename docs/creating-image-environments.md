# Creating Image Environments

## A. Purpose

The Environment Laboratory is the official authoring workflow for image/depth environments in DeepSignals.FM. It is not a disposable sandbox.

The workflow is intentionally split across distinct layers:

- Source/master artwork: private high-quality source image work.
- Optimized production artwork: browser-delivered color asset.
- Depth-map data: grayscale displacement data used as geometry input.
- Laboratory asset metadata: registered asset identity and URLs.
- Authored scene data: behavior + Surface Glow authoring state.
- Production player environment registration: player-facing environment entries and preset wiring.

## B. Recommended Image Workflow

A proven practical workflow is:

1. Generate artwork at a size the image model handles well.
2. A known successful generation size is 1536 x 1152.
3. Upscale afterward (for example with a 4x upscaler) as needed.
4. Keep the original high-quality PNG as your private/source master.
5. Export a production WebP copy for color artwork.
6. Keep the depth map as PNG.

Notes from the first promoted premium environment (Analog Signal Laboratory):

- Exact master dimensions do not need to be exactly 4096 x 3072.
- Color and depth assets must keep identical dimensions, crop, orientation, and aspect ratio.
- WebP is suitable for browser delivery and size reduction.
- PNG is safer for depth maps because the depth image is interpreted as data, not only appearance.

Do not treat one WebP quality value as universal. Inspect details after conversion, especially:

- Cables and wires
- LEDs and light points
- Text-like details
- Knobs and hard mechanical edges

## C. Resolution And Composition Guidance

Useful environment-art guidance:

- 4:3 artwork is currently a practical source format.
- Strong foreground, midground, and background separation improves depth effect.
- Avoid very large blurry foreground objects.
- Prefer deeper depth of field and sharp foreground detail.
- Preserve interesting content across the frame.
- Fullscreen output can crop differently by viewport ratio.
- Keep composition margin around key focal objects.
- Surface Glows work best on recognizable emissive features such as LEDs, displays, mushrooms, eyes, fireflies, and similar points.

Surface Glows are optional. Analog Signal Laboratory intentionally ships with none because its baked-in lighting responds well to global behavior.

## D. Naming Convention

Internal environment and asset ID:

- Kebab-case
- Example: `analog-signal-laboratory`

User-facing display name:

- Example: `Analog Signal Laboratory`

Production files:

- `<environment-id>-color.webp`
- `<environment-id>-depth.png`

Example:

- `analog-signal-laboratory-color.webp`
- `analog-signal-laboratory-depth.png`

Folder layout:

```text
public/
  environments/
    analog-signal-laboratory/
      analog-signal-laboratory-color.webp
      analog-signal-laboratory-depth.png
```

Path responsibilities:

- `public/` is browser-served static content.
- `src/` is application source code.
- `dist/` is generated build output.
- Do not manually author files in `dist/`.

## E. Registering A Laboratory Asset

Asset registration lives in:

- `src/experiments/environment-lab/presets.ts`

The laboratory asset shape is `ImageEnvironmentAsset` from:

- `src/experiments/environment-lab/types.ts`

Representative example:

```ts
{
  id: "analog-signal-laboratory",
  name: "Analog Signal Laboratory",
  colorImageUrl: "/environments/analog-signal-laboratory/analog-signal-laboratory-color.webp",
  depthMapUrl: "/environments/analog-signal-laboratory/analog-signal-laboratory-depth.png",
}
```

Expected URL style for Vite/public assets:

- Root-relative URLs from `public/`, such as `/environments/...`.

After registering, verify:

- Both assets return HTTP 200.
- Dimensions match exactly.
- Aspect ratios match.
- Depth orientation is correct.
- No unexpected transparency behavior.
- No texture 404s in browser/network logs.

Current depth convention (confirmed in `EnvironmentLabScene.tsx` displacement path):

- White is nearer.
- Black is farther.

## F. Authoring In The Environment Laboratory

Laboratory URL:

- `/experiments/environment-lab`

Suggested authoring order:

1. Select a registered image/depth asset.
2. Establish framing and depth-read quality.
3. Tune depth strength and motion.
4. Tune breathing behavior.
5. Tune pointer parallax.
6. Tune hue/color behavior.
7. Tune saturation pulse.
8. Tune global glow pulse.
9. Optionally place Surface Glow hotspots.
10. Stress-test with Neutral, Chill, and Full On behavior presets.
11. Export scene data.

Behavior preset contract in current implementation:

- Behavior presets change only `depth`, `color`, and `saturationPulse`.
- They do not change the active asset.
- They do not change Surface Glow hotspots, coordinates, or hotspot settings.

`Full On` is intentionally extreme. Use it as a stress test or aggressive starting point, not as a default target for every environment.

## G. Surface Glow Guidance

Surface Glow hotspots:

- Use normalized UV coordinates.
- Stay attached through depth breathing, pointer parallax, and viewport resize.
- Are capped by repository limit (`MAX_SURFACE_GLOW_HOTSPOTS` in `src/experiments/environment-lab/constants.ts`).
- Are optional.

Practical guidance:

- Place intentionally; do not cover every bright pixel.
- Vary hotspot phases so all lights do not pulse in lockstep.
- Confirm attachment while breathing and pointer motion are active.
- Prefer global behavior only when it already animates the scene convincingly.

## H. Exporting Scene Data

Current authoring/export distinction:

- Full-scene JSON: exact round-trip authoring payload for import/export in the lab.
- Production scene JSON: normalized identity for promotion to production registries.

Production-normalized scene identity should usually be:

- `id: <asset-id>-default`
- `name: <registered asset display name>`
- `assetId: <active asset id>`

Applying behavior presets should not leave confusing production metadata such as `*-neutral` when promoting a final scene.

Current production scene preset location:

- `src/themes/image-depth/productionScenePresets.ts`

Scene payload contents include:

- Asset identity
- Behavior values
- Surface Glow enabled/defaults/hotspots

## I. Promoting To The Player

Current production integration architecture:

- Generic image/depth production runtime: `src/themes/image-depth/ImageDepthThemeScene.tsx`
- Production image/depth registry: `src/themes/image-depth/productionScenePresets.ts`
- Analog production theme wrapper: `src/themes/analog-signal-laboratory/AnalogSignalLaboratoryTheme.tsx`
- Theme registration: `src/themes/themeRegistry.ts`
- Player scene mounting and image-depth preload mapping: `src/app/PlayerShell.tsx`

A new environment should ideally provide:

- Asset metadata
- Authored scene preset
- Player skin/appearance metadata
- Production registry entry

Avoid cloning entire specialized runtime components per environment.

Current status:

- UV Reactive Jungle remains specialized (`src/themes/uv-reactive-jungle/UvReactiveJungleTheme.tsx`).
- Generic image/depth environments (such as Analog Signal Laboratory) use the shared image-depth runtime.

## J. Stopped And Playing Contract

Intended player-state contract:

Stopped:

- Grayscale
- Stable geometry
- Scene remains visible
- Readable luminance
- No white flash

Playing:

- Smooth transition to color
- Authored color behavior active
- Authored geometry motion follows Motion control
- No environment remount flash

Motion OFF may keep playing-state color evolution while suppressing geometry motion.

## K. Validation Checklist

Laboratory checks:

- Asset is selectable
- Image/depth dimensions match
- Depth orientation is correct
- Behavior controls respond correctly
- Surface Glows remain attached (when used)
- Export/import round-trip works
- No browser console errors

Player checks:

- Environment appears in selector
- Stopped state is grayscale
- Playing transitions to color
- Motion ON/OFF behaves correctly
- No white flash
- Switching environments preserves player state
- Mobile and desktop framing are acceptable

Commands:

```bash
npm run build
npm run lint
git status
git diff --stat
```

Stage new assets before committing.

## Future Work

Tempo-aware preview tooling (for BPM-synced authoring) is planned as a dedicated future enhancement and is not part of the current workflow.