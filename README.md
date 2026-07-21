# DeepSignals.FM

A psychedelic trance radio experience built with React, TypeScript and Three.js.

## Current Status

🚧 Early development

The current public site is a "coming soon" experience while the player is being developed.

## Planned Features

- Multiple visual environments
- Psytrance radio player
- Theme engine
- Community stations
- AI-generated visual experiences
- AI DJ experiments

Built primarily as a learning project and a love letter to psychedelic trance.

## Image Environment Workshop

DeepSignals.FM includes an Environment Laboratory for authoring immersive image/depth environments at:

`/experiments/environment-lab`

Proven workflow:

1. Generate or create source artwork.
2. Upscale to the desired master resolution.
3. Generate a matching depth map.
4. Optimize the production color asset.
5. Add the asset pair under `public/environments`.
6. Register the asset in the laboratory.
7. Tune behavior.
8. Optionally place Surface Glow hotspots.
9. Export production-ready scene JSON.
10. Promote the authored scene into the production player.
11. Validate and commit.

Detailed guide: `docs/creating-image-environments.md`

## Tech Stack

- TypeScript
- React
- Vite
- Three.js
- GitHub Pages
- GitHub Actions

## Local Development

### Prerequisites

Install a current Node.js LTS release, which includes npm.

### Setup

Clone the repository, then install dependencies:

```bash
git clone https://github.com/griffinlochner/DeepSignals.FM.git
cd DeepSignals.FM
npm install
```

Start the local Vite development server:

```bash
npm run dev
```

Vite will print a local URL, typically:

```text
http://localhost:5173/
```

The public landing page is available at `/`.

The work-in-progress player is available locally at:

```text
http://localhost:5173/player
```

## Production Build

Create a production build locally with:

```bash
npm run build
```

Vite writes the production-ready files to the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Commit and Deployment Workflow

GitHub Actions is configured to build and deploy the site to GitHub Pages.

The deployment workflow runs automatically whenever changes are pushed to the `main` branch.

A typical workflow is:

```bash
npm run build
git status
git diff --stat
git add .
git commit -m "Describe the change"
git push origin main
```

What each step does:

- `npm run build` verifies that the production build succeeds.
- `git status` shows the current working-tree state.
- `git diff --stat` provides a compact summary of uncommitted changes.
- `git add .` stages the changes.
- `git commit` saves a local Git checkpoint.
- `git push origin main` uploads the commits to GitHub and triggers deployment.

Deployment progress can be viewed in the repository under:

```text
GitHub → Actions
```

Once the workflow succeeds, GitHub Pages publishes the latest production build to:

```text
https://deepsignals.fm
```

## Notes

- Pushing to `main` deploys the current project build.
- The public landing page is live.
- The `/player` experience remains under active development.
- Direct nested-route handling for GitHub Pages may require additional SPA routing work later.
