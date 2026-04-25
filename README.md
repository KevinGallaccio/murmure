<p align="center">
  <img src="resources/icon.svg" alt="murmure" width="96" height="96" />
</p>

<h1 align="center">murmure</h1>

<p align="center"><em>On rend le murmure visible.</em></p>

<p align="center">
  A live-transcription display for hearing-impaired audiences at podcast festivals and live events.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-2745CF?style=flat-square" /></a>
  <img alt="Electron 33" src="https://img.shields.io/badge/electron-33-2745CF?style=flat-square" />
  <img alt="UI: FR · EN" src="https://img.shields.io/badge/UI-FR%20%C2%B7%20EN-2745CF?style=flat-square" />
  <a href="https://github.com/KevinGallaccio/murmure/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/KevinGallaccio/murmure?style=flat-square&color=2745CF&label=release" /></a>
</p>

---

**murmure** captures audio from a microphone, transcribes it in real time using AssemblyAI's Universal-3 Pro Streaming model, and projects the transcript full-screen onto a secondary monitor with typography you control. It's a small, focused desktop app for one job: making the spoken word readable in the room.

The operator UI ships in French and English (auto-detected from your OS, switchable from a globe icon next to the version). The transcription engine is currently hard-coded to French (`language=fr`) — trivially changed in `src/shared/constants.ts`.

It runs locally, talks directly to AssemblyAI, and stores nothing in the cloud.

---

## Why this exists

Live captioning at small events is usually expensive, technical, or both. The tools that do exist tend to assume a broadcast operator, a captioning workstation, and a software stack that costs more than the festival's coffee budget.

**murmure** is the opposite: one laptop, one microphone, one HDMI cable to the audience screen, one AssemblyAI key. An operator can set it up in five minutes, and the audience reads the transcript in whatever font, size, and contrast suits the room.

If you're running a small French-language event and you'd like to make it accessible, this might be the simplest path.

---

## Install

Pre-built installers are published on the [Releases page](https://github.com/KevinGallaccio/murmure/releases) — grab the `.dmg` for macOS or `.exe` for Windows.

The first time you open an unsigned `.dmg`, macOS Gatekeeper will refuse with *"developer cannot be verified."* Right-click the app → **Open** → confirm in the dialog; subsequent launches work normally. The same applies to Windows SmartScreen (More info → Run anyway). For paid signing/notarization, see the [electron-builder docs](https://www.electron.build/code-signing.html).

---

## Develop

You need [Node.js](https://nodejs.org/) (`brew install node` on macOS) and an [AssemblyAI](https://www.assemblyai.com/) API key.

```bash
git clone https://github.com/KevinGallaccio/murmure.git
cd murmure
npm install
npm run dev
```

Then in the app:

1. Paste your AssemblyAI key under **Configuration / Configuration** and click **Tester la clé / Test key** to verify.
2. Pick your microphone under **Source audio / Audio source** — the VU meter goes live as soon as a device is selected.
3. Click **Ouvrir l'affichage / Open display** to spawn the audience-facing window. With a second monitor connected, it opens fullscreen there automatically.
4. Click **Diffuser / Broadcast** to start streaming.

While idle, the display shows a Victor Hugo extract through the same partial/final pipeline as live transcription, so you can dial in typography from the operator's chair without anyone in the room.

To produce installers locally:

```bash
npm run dist:mac    # produces dist-electron/*.dmg
npm run dist:win    # produces dist-electron/*.exe (NSIS)
```

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                    Main process (Node)                      │
│  • Window lifecycle (control + display)                     │
│  • AssemblyAI WebSocket client                              │
│  • Encrypted settings (electron-store + safeStorage)        │
│  • Session duration tracking → local cost estimate          │
│  • IPC hub between the two renderers                        │
└──────┬──────────────────────────────────┬───────────────────┘
       │ IPC                              │ IPC
┌──────▼─────────────────┐       ┌────────▼───────────────────┐
│  Control renderer      │       │  Display renderer          │
│  (operator's screen)   │       │  (audience screen, HDMI)   │
│                        │ audio │                            │
│  • API key & device    │ + txt │  • Full-bleed transcript   │
│  • Audio capture       │◄─────►│  • Live restyling via CSS  │
│  • Diffuser button     │       │  • No chrome, no controls  │
│  • Style + preview     │       │                            │
└────────────────────────┘       └────────────────────────────┘
```

Three processes, two windows, one WebSocket. Audio is captured in the control renderer (browser APIs: `getUserMedia` + an `AudioWorklet` that downsamples 48 kHz float → 16 kHz int16 PCM in ~100 ms chunks), forwarded to the main process over IPC, and streamed to AssemblyAI via `ws`. Transcripts come back, get broadcast to both renderers, and the display restyles in real time via CSS custom properties pushed over IPC.

The AssemblyAI key never enters the renderer's JS heap — it stays decrypted only in main, encrypted at rest via OS-level `safeStorage` (Keychain on macOS, DPAPI on Windows).

The control window is a three-column workspace: a collapsible sidebar (Configuration / Source / Journal / Costs) on the left, the audience preview as a centered "stage" in the middle, and an always-visible Apparence inspector on the right. The pattern is borrowed from professional creative tools (Figma, Logic Pro): you tweak typography on the right and watch the result on the stage at the same time, never scrolling.

### Project layout

```
murmure/
├── resources/
│   ├── icon.svg / icon.icns / icon.ico   # identity
│   └── fonts/                            # bundled woff2 (Inter, Manrope, …)
├── src/
│   ├── main/                # Electron main process
│   ├── preload/             # contextBridge APIs (per-window)
│   ├── renderer-control/    # operator window (React)
│   ├── renderer-display/    # audience window (React)
│   └── shared/              # IPC types, style types, constants
├── design/
│   └── logos.html           # logo studies (review document)
├── electron-builder.yml     # .dmg / .exe build config
└── .github/workflows/       # CI: build & publish on tag push
```

---

## Configuration & cost

AssemblyAI doesn't expose a public balance API, so murmure tracks streaming duration locally and estimates cost at a configurable rate (default $0.45/h, the U3 Pro Streaming base rate at time of writing). The figure under **Coûts & usage / Costs & usage** is *an estimate* — for the canonical number, click **Tableau de bord / Dashboard** to open AssemblyAI's billing page in your browser.

The display style — typeface, size, line height, colors, padding, alignment, max visible lines — is fully customizable from the inspector with a live preview. Three presets ship: **Grand contraste / High contrast** (high contrast for low-vision audiences), **Sobre / Subtle** (softer, longer reading sessions), and **Lecture longue / Long reading** (extended sessions with looser line spacing).

Six typefaces ship bundled for the audience display (no remote fonts at runtime): Inter, Manrope, Atkinson Hyperlegible (the one designed by the Braille Institute for low-vision readers — recommended), IBM Plex Sans, Roboto Slab, and JetBrains Mono. The operator UI uses Fraunces for editorial titles and Manrope for body text.

### Tuning end-of-turn detection

AssemblyAI's streaming is turn-based: a final transcript commits when the model detects a silence pause. murmure ships with tightened defaults — `min_end_of_turn_silence_when_confident: 100 ms`, `max_turn_silence: 1400 ms` — so commits land on every breath/comma rather than only at long pauses. See `src/shared/constants.ts → ASSEMBLY_PARAMS` if you want to tune further.

---

## Identity

The icon — three discrete dots transitioning into a continuous line — visualizes the brand promise: *scattered sound becoming continuous text*. The leftmost dot is rendered in `#2745CF`, exactly the color the app uses for partial (in-flight) transcripts, deliberately closing the loop between identity and interface. The wordmark is set in [Manrope](https://fonts.google.com/specimen/Manrope).

See [`design/logos.html`](design/logos.html) for the full review document (open it in a browser).

---

## Contributing & forking

This is a small, deliberate project — I'm happy to take PRs that fix bugs or improve accessibility. The scope is intentionally narrow. If you want to fork it for a different language, different STT backend, or different deployment shape, please do; that's why it's MIT-licensed.

Things explicitly out of scope: transcript export to file (live-only by design), speaker diarization, multi-language switching mid-stream, cloud sync, auto-update, telemetry.

---

## Credits

- [AssemblyAI](https://www.assemblyai.com/) — Universal-3 Pro Streaming model
- [Atkinson Hyperlegible](https://brailleinstitute.org/freefont) — Braille Institute, designed for low-vision readers
- [Electron](https://www.electronjs.org/), [Vite](https://vitejs.dev/), [React](https://react.dev/) — the boring-but-correct desktop stack
- Victor Hugo, *Demain dès l'aube* — used as the demo-mode placeholder text

## License

MIT — see [`LICENSE`](LICENSE).
