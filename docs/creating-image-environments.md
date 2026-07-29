# Creating Image Environments

## A. Purpose

This guide documents the current source-controlled workflow for image/depth environments in DeepSignals.FM.

The workflow is intentionally split across layers:

- Source/master artwork: private high-quality source image work.
- Optimized production artwork: browser-delivered color asset.
- Depth-map data: grayscale displacement data used as geometry input.
- Environment registration: metadata and asset URLs in the production catalog.
- Production scene data: behavior and optional ambient particle settings in source-controlled presets.

## B. Recommended Image Workflow

A practical workflow is:

1. Generate artwork at a size the image model handles well.
2. A known successful generation size is 1536 x 1152.
3. Upscale afterward (for example with a 4x upscaler) as needed.
4. Keep the original high-quality PNG as your private/source master.
5. Export a production WebP copy for color artwork.
6. Keep the depth map as PNG.

Notes:

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
Keep emissive features, lighting cues, and bloom-friendly details readable so the scene still feels lively after depth processing.

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

## E. Registering In The Production Catalog

Environment registration lives in:

- `src/themes/image-depth/environmentCatalog.ts`

Production scene preset definitions live in:

- `src/themes/image-depth/productionScenePresets.ts`

Shared image-depth constants live in:

- none required for the current image environment workflow

Expected URL style for Vite/public assets:

- Root-relative URLs from `public/`, such as `/environments/...`.

After registering, verify:

- Both assets return HTTP 200.
- Dimensions match exactly.
- Aspect ratios match.
- No unexpected transparency behavior.
- No texture 404s in browser/network logs.

Current depth convention in runtime displacement:

- White is nearer.
- Black is farther.

## F. Scene Preset Guidance

Production scene presets should include:

- Asset identity
- Behavior values (`depth`, `color`, `saturationPulse`)
- Optional ambient particle preset values

## G. Production Integration

Current production integration architecture:

- Generic image/depth runtime: `src/themes/image-depth/ImageDepthThemeScene.tsx`
- Production image/depth registry and seeds: `src/themes/image-depth/environmentCatalog.ts`
- Production scene preset definitions: `src/themes/image-depth/productionScenePresets.ts`
- Theme registration: `src/themes/themeRegistry.ts`
- Player scene mounting and preload mapping: `src/app/PlayerShell.tsx`

Current status:

- UV Reactive Jungle remains specialized (`src/themes/uv-reactive-jungle/UvReactiveJungleTheme.tsx`).
- Generic image/depth environments use the shared image-depth runtime.

## H. Validation Checklist

Checks:

- Environment appears in selector.
- Image/depth dimensions match.
- Stopped state is grayscale.
- Playing transitions to color.
- Motion ON/OFF behaves correctly.
- No white flash.
- Switching environments preserves player state.
- Mobile and desktop framing are acceptable.

Optional DEV verification:

- Verify runtime behavior in `/experiments/reactivity-lab` while running locally in development mode.

Commands:

```bash
npm run validate:environments
npm run build
npm run lint
git status
git diff --stat
```