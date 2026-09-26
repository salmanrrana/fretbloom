# YouTube captions

FretBloom can read caption tracks published with a public YouTube video. This is an optional aid for lining words up with detected notes. It is not speech-to-text, and it does not create lyrics for songs that have no usable captions.

## API

`GET /api/youtube-captions/:videoId` accepts an exact 11-character YouTube video ID. The server builds the watch URL itself; callers cannot supply an arbitrary URL.

A usable track returns HTTP 200:

```json
{
  "status": "available",
  "language": "en",
  "automatic": false,
  "cues": [{ "start": 1.2, "end": 3.8, "text": "First caption line" }]
}
```

Cues are ordered and do not overlap. Times are seconds. `automatic` is `true` only for YouTube's automatically generated source captions.

A public video with no usable caption track is a normal result, also returned with HTTP 200:

```json
{
  "status": "unavailable",
  "language": null,
  "automatic": false,
  "cues": []
}
```

Malformed IDs, unsupported videos, downloader failures, limits, and timeouts use the same actionable JSON error shape as the audio endpoint:

```json
{
  "error": {
    "code": "VIDEO_TOO_LONG",
    "message": "Videos must be 600 seconds or shorter."
  }
}
```

## Track selection

The server prefers human-authored captions. Within those tracks it prefers yt-dlp's detected source language, then English, then another available language.

If no manual track is available, the server first asks for yt-dlp's `-orig` automatic track in the detected source language. Some non-translatable source tracks use the plain language key, so the server tries that key only when yt-dlp reported the video's source language. When yt-dlp does not report a source language, it tries only `en-orig`. Translated automatic tracks are deliberately excluded so translated text is never presented as the video's original captions.

YouTube json3 can contain repeated rolling updates to the same caption window. The parser collapses exact and cumulative updates, removes empty formatting events, normalizes whitespace, clips cues to the video duration, and trims overlaps before returning them.

## Limits and privacy

Caption retrieval is separate from audio analysis. A missing or failed caption request does not discard detected notes or a downloaded audio result.

The middleware:

- accepts finished public videos no longer than 10 minutes;
- caps a caption file at 2 MiB;
- limits concurrent and repeated requests;
- stops yt-dlp on timeout or client disconnect and removes its temporary directory;
- invokes the project-local `.tools/youtube/bin/yt-dlp` directly, without a shell;
- disables configuration files, cookies, browser cookies, and playlists, and does not enable `.netrc` credentials; and
- never returns downloader output, local paths, cookies, or credentials to the client.

Use `npm run setup:youtube` to install the pinned project-local yt-dlp release. The caption endpoint does not need ffmpeg.

YouTube captions are not guaranteed to be song lyrics. Many music videos have no captions, automatic captions may be inaccurate, and public extraction can stop working when YouTube changes its site. The UI should keep pasted lyrics available as the dependable fallback.

## Verification

The implementation was checked against the official yt-dlp [subtitle options](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#subtitle-options) and the project-pinned 2026.08.19 YouTube extractor, including its original versus translated automatic-track keys.

On 2026-09-16, the running standalone server at `127.0.0.1:5202` returned `available`, `language: en`, `automatic: false`, and six ordered cues for public video `jNQXAC9IVRw`. A separate probe of `M7lc1UVf-VE` returned the expected 413 because it exceeds the duration limit. No caption text is included in this verification record.

The complete 67-test suite, lint, typecheck, and production build pass. `e2e-lyrics.mjs` passed against both Vite and the built standalone app. It checks note grouping, instrumental gaps, seeking/highlighting, persistence, edit timing preservation, caption failure, LRC clearing timestamps, manual line timing, canceled-request races, changing videos, and mobile overflow with controlled caption/video fixtures. `e2e-youtube-sync.mjs` also passes with the new view switch.
