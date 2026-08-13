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

Behind the ⚘ greenhouse toggle: **Songbook** (paste any chord tab — the whole
sheet renders with lyrics and every chord lights up as the song moves; with
the mic on it hears you strum the right chord and advances by itself; link a
YouTube video and tap through it once to sync, after which pressing play makes
the chords follow the recording), **Listen** (strum a target chord and the
wall blooms when you nail it). Rough edges expected.

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

- Listen and songbook follow modes want headphones — through speakers the app
  hears itself.
- The songbook keeps your original paste and renders it whole; chord chips in
  the sheet are live (tap to jump, lit when current).
- Video sync talks to the YouTube embed through its postMessage API
  (enablejsapi) — one tap-through stores per-chord timestamps in localStorage,
  then the sheet follows the video clock and sheet taps seek the video.
