# fretbloom

hear the chord · see the tab · let the room glow

A chill, browser-only companion for learning guitar. No accounts, no uploads —
everything (synthesis, pitch detection, chord matching) runs locally in Web Audio.

## Modes

- **Play along** — pick a song, hit play. A Karplus-Strong string synth strums the
  progression while the current chord's name, notes, fingering diagram, and ASCII
  tab fill the left card; the upcoming chord waits on the right so your hand can
  get there early. A timeline strip shows the whole loop.
- **Listen** — pick a target chord, strum your real guitar. A chroma matcher scores
  what the mic hears against the chord's pitch classes; nail it and the whole room
  blooms mint green, with the chord shape cameo in the corner lighting up.
- **Tune** — chromatic tuner (autocorrelation/NSDF pitch detection with octave-error
  guards), needle in cents, string chips for standard EADGBe.

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
node e2e-check.mjs # Playwright UI smoke test (needs dev server on :5199)
node e2e-audio.mjs # audio-pipeline test with a synthesized mic signal
```

## Deploy

Deployed on Netlify from `netlify.toml` (`npm run build` → `dist/`).

## Notes

- Audio scheduling uses the Web Audio lookahead pattern, so UI jank never
  causes timing lag; plucks are rendered once per note and cached as buffers.
- Listen mode wants headphones — through speakers the app hears itself.
- Tab display is per-chord (chord frames, not note-for-note transcription).
