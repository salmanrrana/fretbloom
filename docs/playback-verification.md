# Playback and readable lyrics verification

Verified against the actual in-app browser and local standalone app at `http://127.0.0.1:5202/` on 2026-09-16. UI actions used computer use, including song import, playback, lyric seeking, speed selection, focus mode, and reload. These checks used real upstream media, not fixture responses.

## Reproduced problem

The user's saved `3VoWqGhLvF8` recording displayed “This video is unavailable” after note analysis. An isolated page containing both the original privacy embed and a standard YouTube embed with explicit origin reproduced it without FretBloom or analysis. Both emitted `onError: 150`. Per the official [iframe player API](https://developers.google.com/youtube/iframe_api_reference#onError), errors 101/150 indicate the owner does not allow playback in embedded players. The metadata alone was misleading: yt-dlp reported `playable_in_embed: true`.

The existing hook ignored player errors, so the screen stranded the user beside a broken player. The recording also had no usable captions, leaving the lyrics area empty. The earlier fixture-only verification did not establish that this actual song could be played.

## Changes

- Subscribe to real player errors, preserve source/origin checks, and add explicit embed origin, referrer policy, and inline playback configuration.
- Use the same analyzed recording as an in-memory audio fallback when the embedded player fails. The user can also choose audio directly. Saved songs fetch audio again after a reload; no audio bytes are put into local storage.
- Share one clock across playback, lyric and note highlighting, seeking, rewind, and speed controls.
- Look up matched timed lyrics through LRCLIB only after captions fail. Require structured track/artist metadata and close duration matching; never assign guessed text or timing.
- Increase lyrical text to approximately 29px on wide screens and 22px at the checked narrow breakpoint. Add a focus view, a follow toggle, sticky playback controls, and collapse the raw note list by default.
- Keep loading and error recovery visible even in focus mode; show genuine retrieval/analysis progress states.

## Actual browser results

1. Imported `3VoWqGhLvF8` through the form as “Playback check — I Saw the Light”. Observed retrieval, completed extraction with 99 estimated notes, automatic player-error fallback, and 24 timed LRCLIB lyric lines.
2. Pressed Play song. The real audio element reported `paused: false`, `readyState: 4`, and an advancing current time. A lyric click moved it to about 29 seconds and selected that row. Selecting 0.75× changed the real element's playback rate to 0.75. Pause stopped it.
3. Imported `DD3IZB0SGC4` as “Video check — Backwoods Bluegrass”. Analysis completed with 79 estimated notes and automatic captions. The real embedded video played (`paused: false`, `readyState: 4`), and a lyric click moved the video to about 20.45 seconds while the active lyric row showed 0:20. Audio fallback was not active.
4. Checked the wide and narrow practice layouts and focus mode. DOM measurements showed no horizontal document overflow; focus mode retained a compact transport. The browser had existing 80% zoom, so screenshot scaling was imperfect; readability/overflow measurements were taken from the live DOM as well. The temporary viewport override was reset.
5. Reloaded the whole app, opened the user's original saved “i saw the light”, and confirmed that its saved 99-note analysis was reused, matched lyrics loaded, fresh audio reached ready state 4, and playback advanced again. No visible error remained. Paused playback after verification.

All 83 unit/integration tests, lint, typecheck, production build, and whitespace checks passed. The focused `e2e-playback.mjs` retains the controlled embed-150/cold-cache regression scenario (its prototype was exercised separately; the retained file received syntax validation). Existing browser fixtures were updated for the new controls and lyrics fallback. The Impeccable layout detector returned no findings for the changed UI.

This does not make owner-blocked embedded videos playable. Those uploads use in-page song audio; videos that permit embedding continue playing normally. Note estimates and automatic caption accuracy remain limited by the recording.
