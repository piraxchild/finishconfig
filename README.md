# Finish configurator

Browser-based finish/fabric configurator for the furniture library.

## Run locally
    npm install
    npm run dev

## Deploy to GitHub Pages
1. Create a repo on GitHub (public, or private on a paid plan) and push this folder to `main`.
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` builds and deploys. URL: `https://<user>.github.io/<repo-name>/`

The workflow sets the base path from the repo name automatically.

## Library
`src/App.jsx` currently contains a procedural demo library (`LIBRARY` + `buildPiece`).
Production plan: drop GLBs into `public/library/<piece-id>/`, generate `index.json`
with a scan script, and replace `buildPiece` with `GLTFLoader`.
