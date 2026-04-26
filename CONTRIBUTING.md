# Contributing to murmure

Thanks for thinking about helping. murmure is a small, focused project — see the [README](README.md) for what it is and what's intentionally out of scope.

## Local development

```bash
git clone https://github.com/KevinGallaccio/murmure.git
cd murmure
npm install
npm run dev
```

You'll need [Node.js 20+](https://nodejs.org) and (for live testing) an [AssemblyAI](https://www.assemblyai.com/) API key.

## Pull request flow

1. Fork the repo and branch from `main`. Branch names like `fix/<short-description>` or `feat/<short-description>` are appreciated but not required.
2. Make your change. Keep it focused — one PR, one concern.
3. Run `npm run build` locally to confirm typecheck and bundle pass.
4. Open a PR against `main`. Fill out the template — especially the **How to verify** section so a reviewer can reproduce.
5. The CI build runs automatically on every push to your PR. Once it's green and a maintainer has reviewed, the PR is squash-merged into `main`.

The `main` branch is protected:

- All changes go through a PR
- The CI build must pass before merge
- Force-pushes and deletions are blocked
- History is linear (squash-merge only)

## What kinds of PR are welcome

- **Bug fixes**, especially around accessibility — bad contrast, screen-reader gaps, keyboard navigation, etc.
- **Small UX improvements** that fit the existing design language.
- **Documentation** improvements.
- **Localization** — fixes to the existing FR/EN strings or adding a new language. The i18n layer is in [`src/renderer-control/i18n.tsx`](src/renderer-control/i18n.tsx).

## What kinds of PR will likely be declined

- Features that broaden the scope (transcript export, diarization, mid-stream language switching, cloud sync, telemetry).
- Major design overhauls without prior discussion — please open an issue first so we can talk about it.
- Heavy new dependencies for things solvable with what's already bundled.

## Code conventions

- TypeScript strict mode is on; the build must pass.
- React components live under `src/renderer-control/components/`.
- French and English strings live together in `src/renderer-control/i18n.tsx`. Don't hard-code user-facing strings in components.
- The design system is hand-rolled in `src/renderer-control/styles.css`. Don't introduce a CSS framework; reach for the existing tokens (`--ink-*`, `--paper-*`, `--indigo`, `--s-*` spacing scale).
- The brand mark and palette are locked. If you're touching them, ask first.

## Reporting issues

Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) templates. Include the murmure version (top-right of the titlebar) and the OS for any bug.
