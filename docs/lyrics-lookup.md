# Synced lyrics lookup

FretBloom can use LRCLIB as a fallback when a public YouTube music video has no usable captions. This lookup is deliberately narrow: it returns synchronized lyrics only when YouTube exposes structured track metadata and LRCLIB returns the same track and artist with a matching duration.

## Primary-source findings

LRCLIB's official [API documentation](https://lrclib.net/docs) defines `GET /api/get` for metadata lookup. `track_name` and `artist_name` are required; `album_name` and `duration` are optional, but the documentation calls duration crucial and says matches must be within about two seconds. A missing track returns 404. The response includes track, artist, album, duration, an instrumental flag, and plain and synchronized lyrics when available.

The same documentation requires an identifying `User-Agent` (or one of its alternative client headers). It also requires clients to honor 429 responses and `Retry-After`, and recommends sequential requests. FretBloom sends one LRCLIB request per lookup with an identifying `User-Agent`, relays rate limiting as a retryable error, and does not use the search endpoint.

LRCLIB's official [architecture and matching rules](https://github.com/tranxuanthang/lrclib/blob/main/ARCHITECTURE.md#matching-rules) confirm that `/api/get` normalizes names, compares lowercase text with punctuation mostly removed, uses roughly ±2 seconds for duration, and prefers records containing synchronized lyrics. Because this matching is intentionally somewhat fuzzy, FretBloom validates the returned metadata again before using any text.

yt-dlp's official [output-template documentation](https://github.com/yt-dlp/yt-dlp/blob/master/README.md#output-template) documents the structured media fields used by the metadata request. FretBloom reads only yt-dlp's `track`, `artist`, `album`, `duration`, and live-status fields. It does not split or guess artist and title from a display title.

No official LRCLIB source reviewed here states a client-side attribution requirement. FretBloom still returns a visible LRCLIB name and link so users know where the result came from.

## API contract

`GET /api/youtube-lyrics/:videoId` accepts an exact 11-character YouTube video ID. The server constructs the YouTube URL and LRCLIB URL itself; callers cannot supply either URL.

A trusted synchronized result returns HTTP 200:

```json
{
  "status": "available",
  "language": null,
  "automatic": false,
  "cues": [{ "start": 10.57, "end": 15.2, "text": "..." }],
  "source": "lyrics",
  "attribution": {
    "name": "LRCLIB",
    "url": "https://lrclib.net"
  }
}
```

`language` remains `null` because the LRCLIB response does not identify a language. `automatic` is always `false`: the service returns contributed synchronized lyrics rather than YouTube automatic captions.

No record, missing structured YouTube music metadata, an instrumental record, a metadata mismatch, plain lyrics without timestamps, or malformed timing returns a normal unavailable result:

```json
{
  "status": "unavailable",
  "language": null,
  "automatic": false,
  "cues": [],
  "source": "lyrics",
  "attribution": {
    "name": "LRCLIB",
    "url": "https://lrclib.net"
  }
}
```

Malformed IDs, unsupported videos, timeouts, local tool failures, oversized responses, and LRCLIB failures use actionable JSON errors. The endpoint does not return LRCLIB error bodies.

## Match policy

The lookup sends the exact structured YouTube track, artist, and rounded duration to `/api/get`. It omits album from the request because the same recording commonly appears on multiple releases and compilations. Album metadata is retained for diagnosis but is not used to broaden the query.

A response is accepted only when:

- normalized track names are equal;
- normalized artist names are equal;
- LRCLIB duration differs from the YouTube duration by no more than two seconds;
- the record is not marked instrumental;
- synchronized LRC is present and fully parseable; and
- every timestamp fits the video duration, with at most the same two-second boundary tolerance.

There is no `/api/search` fallback, title-only lookup, display-title parsing, untimed text spreading, or guessed tempo. A questionable match stays unavailable so it cannot attach words from another recording to detected notes.

The LRC parser accepts explicit timestamps, metadata tags, offsets, repeated timestamps for the same written line, enhanced word-timing tags, and empty timestamp markers for instrumental breaks. It rejects mixed timed and untimed text, duplicate cue times, invalid seconds, negative adjusted times, more than 5,000 cues, or timestamps incompatible with the video. Returned cues are ordered and non-overlapping.

## Bounds and privacy

The middleware uses the same project-local yt-dlp process runner as audio and caption retrieval, including process-tree cancellation. It disables yt-dlp configuration files, cookies, browser cookies, and playlists. The local metadata request and LRCLIB request share a 45-second timeout and stop on client disconnect.

Videos remain limited to 10 minutes. LRCLIB response bodies are streamed with a 1 MiB cap before JSON parsing. Work is concurrency-limited and requests are rate-limited by directly connected address. Responses are not cached and never include downloader output, local paths, credentials, LRCLIB plain lyrics, or rejected candidate text.

## Live verification

On September 16, 2026, yt-dlp returned structured metadata for YouTube video `3VoWqGhLvF8`: track `I Saw the Light`, artist `Hank Williams`, album `The Legend Hank Williams`, and duration 164 seconds.

The exact LRCLIB request including that album returned 404. The official API allows album to be omitted; the request using exact track, artist, and duration returned record 6729 with the same track and artist, a duration of 165 seconds, and synchronized lyrics. Its album is `Gospel Favorites`, consistent with the same recording appearing on another compilation.

An end-to-end probe through `createYouTubeLyricsMiddleware()` returned HTTP 200 with 24 cues. The first cue starts at 10.57 seconds; all cues were ordered, non-overlapping, and within the 164-second video. The verification logged only metadata and timing counts, never lyric text.
