# fretbloom

tune it and the wall blooms

A guitar tuner built around one idea: the background is a film photograph of a
lantana-and-bougainvillea wall, desaturated and asleep. As you pull a string
toward pitch the wall literally comes back into color — full bloom, breathing,
when you're in tune. No accounts, no uploads — everything runs locally in Web Audio.

## The tuner

- Autocorrelation/NSDF pitch detection with octave-error guards, ~±1 cent
- Auto nearest-string detection, or tap a string chip to lock it
- 8 tunings (standard, drop D, half/full step down, DADGAD, open G/D/E)
- Tune-up/tune-down direction advice, cents needle, Peterson-style strobe ribbon
- Per-string ✓ tracking with an all-six celebration
- A4 calibration 432–446 Hz

## The greenhouse (experimental modes)

Behind the ⚘ greenhouse toggle: **Play along** (synth strums chord progressions
with now/next tab cards), **Songbook** (paste any chord tab, link a YouTube
video, follow along), **Listen** (strum a target chord and the wall blooms when
you nail it). Rough edges expected.

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
