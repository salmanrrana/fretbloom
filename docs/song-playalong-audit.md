# Song upload and play-along audit

Date: 2026-09-26. Work is isolated in `/home/xtra/code/personal_projects/fretbloom-song-audit`, branch
`fix/song-playalong-audit`, local server `http://127.0.0.1:5202`. The existing
checkout, its port 5173 server, and older Netlify site are untouched. A separate
Railway Free deployment was created afterward.

## Recording and reference

- Recording: [Daniel Romano — Time Forgot (To Change My Heart), official video](https://www.youtube.com/watch?v=MDTgKVF-IZM).
- Reference: [Ultimate Guitar sheet 1047535](https://tabs.ultimate-guitar.com/tab/print?app_utm_campaign=Export2pdfCopy&flats=0&font_size=0&id=1047535&is_ukulele=0&simplified=0&transpose=0).
- The actual public recording was imported through the application's form,
  without mocked requests. The returned WAV is 238.250667 seconds, 5,718,094
  bytes. The browser analyzed 2,792 frames. The sheet parses to 86 steps using
  D, A, C#m, F#m, and C#7. No capo is specified.
- YouTube refused embedded playback in this browser; the app successfully
  switched to the same recording as in-page audio. Automatic captions loaded.
- Private evidence was captured during the audit in a temporary directory,
  including the retrieved sheet, WAV, saved browser state, features, and
  screenshots. That directory is no longer retained. A compact feature fixture
  remains for alignment checks; full lyrics and audio are not in the repository.

## Issues reproduced before editing

| ID  | Priority | User-visible failure                                                           | Evidence and reproduction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P1       | One held chord appears to require several simultaneous plays.                  | Open **Lyrics & notes**, play to 5.4 s, pause: three separate A buttons have `.sounding`, including a future row. Browser assertion that only one occurrence is current fails `3 !== 1`. Screenshot `duplicate-highlights-before.png`.                                                                                                                                                                                                                                                                                                                      |
| 2   | P1       | Clicking a chord while paused selects the preceding chord instead.             | On **Chord sheet**, click the sixth D (step 21). The requested 54.357333333 s becomes 54.357333 s in the audio element. The highlighted chord settles on F#m. Assertion that clicked D remains selected fails.                                                                                                                                                                                                                                                                                                                                              |
| 3   | P1       | Automatic timing claims success despite weak chord placements.                 | Original map assigns D for 0.256 s at 54.357, 133.717, and 211.712 s, hitting the aligner's minimum duration. The app says **synced to video** while warning that those steps were not heard clearly. The first and third have much weaker raw support than surrounding chords. Further inspection found that several other quick outro D/A changes do have raw spectral support even though free recognition smooths them into A; fast changes alone are not a defect. These are measured evidence conflicts, not an independently verified transcription. |
| 4   | P2       | The reference's C#7 and the detector's C# appear as competing answers.         | The reference has dominant sevenths; free recognition supports only major/minor triads, but the timeline calls these the chords heard. This limitation is not explained alongside the result. Reference voicings must not be silently reduced to triads.                                                                                                                                                                                                                                                                                                    |
| 5   | P2       | Correct sheet lyrics become hard to choose after automatic captions arrive.    | **Lyrics & notes** displays fragmented automatic captions with word errors; **Edit lyrics** contains those captions, and the earlier **Use lyrics from your sheet** action disappears. The intact reference is still visible in **Chord sheet**.                                                                                                                                                                                                                                                                                                            |
| 6   | P2       | Reading the sheet and seeing the current fingering require separate scrolling. | At 390×844, the fingering card is below the sheet and analysis panel, over 1,200 CSS px down. At 1440×1000 the desktop card's lower controls extend below the visible side pane. Screenshots `mobile-before.png`, `analysis.png`.                                                                                                                                                                                                                                                                                                                           |
| 7   | P2       | “Now” remains lit before the first mapped chord and after playback ends.       | D is called current at 0 even though the first mapped D begins at 0.683 s. At the audio end, 238.250667 s, F#m remains labeled **Outro · now**. Preparing, playing, and finished need distinct presentation.                                                                                                                                                                                                                                                                                                                                                |
| 8   | P1       | A matching intro-only sheet is placed much later and rejected.                 | During integration verification, replaying the first eight reference chords against the real extracted audio selected 198.656–224.256 s, then reported an omitted C# at 3:27. The complete sheet's same first eight chords and unconstrained audio both support the actual intro around 0.7–16.6 s. A user practicing just the intro should receive that supported span.                                                                                                                                                                                    |

## Checks already passing

The real link imports; all 86 reference steps parse; audio fallback plays;
play/pause, speed changes, lyrics focus, and persistence through reload work.
No page errors were reported during these flows. The original sheet remains
intact, and automatic results preserve its C#7 spelling in the main chord card.

## Fix ownership

- Audio agent: alignment, recognition, analysis result storage, analysis panel,
  and narrowly scoped audio/import flow verification.
- Lyrics agent: lyrics grouping/display and reference-text recovery; lyrics flow
  verification. Coordinate any CSS needs with the playback agent.
- Playback agent: playback clock, seek boundaries, player layout/current state,
  CSS, and playback flow verification.
- Main agent: this report, integration review, and final real-song browser pass.

The first three agent starts failed because authentication could not refresh.
A retry succeeded; all three fixes were delegated to GPT-6 Sol at medium effort.

## Verification after fixes

The reported UI defects are fixed. Held chords have one active occurrence,
continuations say **held** and seek to their own lyric line, and fractional
seeks retain the selected chord. The current fingering is above optional
analysis details; numbered-tab fingering remains available on mobile. Ready,
playing, selected practice, unrecognized tail, and finished states are distinct.

Additional integration corrections prevent an untimed practice chord from
competing with the audio chord in **Lyrics & notes**, put the timing warning
beside the sheet, and remove the redundant **Now** readout when the main card
already follows the audio. A real intro replay caught transient blank frames
at chord boundaries; deriving the selected step directly from the shared clock
removed that delay. The existing playback flow now checks for these blanks.

### Real recording

- All 86 parsed chord voicings contain the expected pitch classes, including
  the seventh in C#7. This verifies the displayed guitar shapes, not independent
  identification of every note in the mixed recording.
- A complete 238.250667-second playback at 1.25× produced 1,908 sampled UI
  states: at most one active lyric chord, no active chord in a future/past row,
  no page errors, and **Finished** at the end. This used the actual retrieved
  song audio and automatic captions, not a synthetic recording.
- The eight-chord reference intro was separately imported through the UI with
  real network requests. It aligns at 0.683, 2.048, 3.755, 5.120, 8.363, 9.557,
  11.008, and 12.800 s, with a covered end of 16.555 s.
- Seeking to its first D requests 0.682666667 s; the browser reports
  0.682666 s, and the correct D remains selected. A subsequent live intro pass
  captured 563 samples, saw all eight changes with no blank between them, and
  cleared the highlight after the section ended.
- Desktop 1440×1000 and mobile 390×844 were inspected. Mobile has no horizontal
  overflow. The mechanical design check only found existing overridden lyric
  borders and an existing microphone-meter width animation, outside this fix.

### Automated checks

All passed in the isolated checkout:

```sh
npm run check:fast # lint, strict types, 104 existing and focused tests
npm run build
BASE_URL=http://127.0.0.1:5202 node e2e-youtube-sync.mjs
BASE_URL=http://127.0.0.1:5202 node e2e-lyrics.mjs
BASE_URL=http://127.0.0.1:5202 node e2e-playback.mjs
git diff --check
```

Added coverage extends complete user flows: a held chord crossing lyric lines,
replacing captions with sheet text, seeking a fractional-time chord, playing
through a boundary, finishing a section, and switching between an untimed sheet
and audio-following lyrics. The compact real-recording feature fixture contains
numeric features and chord targets, with no lyrics or playable audio.

### Remaining musical limit

**The entire song is not certified note-perfect or automatically synced to the
reference.** The first and third short D placements have weaker raw support than
neighboring chords. The middle D placement and several quick outro changes have
some support; the evidence does not establish that the sheet is wrong. The app
now refuses a misleading full automatic map, explains which steps need review,
and provides manual timing. Major/minor audio estimates can still misread a dense
mix and do not independently verify seventh chords.

The alignment now penalizes prolonged contradictions more strongly, so the
intro matches its actual opening rather than a longer incorrect later passage.
Automatic section end times are saved. Analysis version 3 replaces older
automatic maps while preserving the user's manual timing. Pasted reference
lyrics can replace imperfect captions, but plain words still need manual timing.

All implementation changes remain in `/home/xtra/code/personal_projects/fretbloom-song-audit` on branch
`fix/song-playalong-audit`. The original checkout, its existing preview server,
and the older Netlify site were not changed.

Verification ran in a temporary checkout before it was moved to the permanent
path above. The audit browser and port 5202 server were stopped afterward.
Run `npm run dev -- --host 127.0.0.1 --port 5202 --strictPort` in this checkout
to review the changes locally.

### Railway Free deployment

The new Railway app and private Postgres passed live owner sign-in and
create/reload/edit/reload/delete/reload. Public tuner and Listen paths return
200; Songbook and its API return 401 without the owner password. The song
audio request for `MDTgKVF-IZM` returned 422 from Railway because YouTube
challenged its cloud IP with HTTP 429. This limits hosted link analysis despite
the local real-recording verification above. See [Railway deployment](railway-deployment.md)
for the URL, credentials location, and remaining audio-source decision.
