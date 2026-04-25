Bundled fonts (Latin subset, woff2). Sourced from Google Fonts via the
fonts.googleapis.com CSS API on 2026-04-25.

Files:
  Inter.woff2                       — variable font, weight axis 100..900
  AtkinsonHyperlegible-400.woff2    — regular
  AtkinsonHyperlegible-700.woff2    — bold (used for 600/800 slots)
  IBMPlexSans.woff2                 — variable font, weight axis 100..700
  RobotoSlab.woff2                  — variable font, weight axis 100..900
  JetBrainsMono.woff2               — variable font, weight axis 100..800

Total ~177 KiB. The @font-face declarations live in:
  src/renderer-display/styles.css
  src/renderer-control/styles.css

Both renderers reference these via Vite (relative '../../resources/fonts/'),
so the assets are content-hashed and copied into the renderer bundle at build
time. The local('...') fallback remains so the OS-installed font is used if
present; otherwise the woff2 is loaded.

Licenses (all permissive — OFL / Apache 2.0):
  Inter:                 SIL OFL — https://github.com/rsms/inter
  Atkinson Hyperlegible: SIL OFL — https://brailleinstitute.org/freefont
  IBM Plex Sans:         SIL OFL — https://github.com/IBM/plex
  Roboto Slab:           Apache 2.0 — https://github.com/googlefonts/RobotoSlab
  JetBrains Mono:        SIL OFL — https://github.com/JetBrains/JetBrainsMono
