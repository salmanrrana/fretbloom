import { useEffect, useState } from 'react'
import type { useSongPlayback } from './useSongPlayback'

type Playback = ReturnType<typeof useSongPlayback>

function timestamp(time: number) {
  return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
}

export function SongPlayback({
  videoId,
  title,
  duration,
  playback,
}: {
  videoId: string
  title: string
  duration: number
  playback: Playback
}) {
  const { clock, useAudio } = playback
  const [position, setPosition] = useState(0)
  const [speed, setSpeed] = useState('1')
  useEffect(() => {
    const timer = window.setInterval(() => setPosition(clock.time() ?? 0), 100)
    return () => window.clearInterval(timer)
  }, [clock])
  useEffect(() => {
    setSpeed('1')
  }, [useAudio])

  return (
    <section className="song-playback" aria-label="Song playback">
      <div className="video-frame" hidden={useAudio}>
        <iframe
          ref={playback.iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&playsinline=1&rel=0`}
          title={`${title} video`}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {useAudio && (
        <div className="song-audio-status">
          <strong>Play along with the song audio</strong>
          <p>
            {playback.videoError === 101 || playback.videoError === 150
              ? 'This upload blocks embedded video. Its audio plays here with your lyrics and notes.'
              : 'Use the song audio here with your lyrics and notes.'}
          </p>
          {!playback.ready && !playback.audioError && (
            <p role="status">Preparing song playback…</p>
          )}
          {playback.audioError && (
            <>
              <p role="alert">{playback.audioError}</p>
              <button className="quiet-btn" onClick={playback.retryAudio}>
                Retry song playback
              </button>
            </>
          )}
        </div>
      )}
      {playback.audioUrl && (
        <audio
          ref={playback.audioRef}
          src={playback.audioUrl}
          preload="auto"
          onCanPlay={() => playback.setAudioReady(true)}
          onPlay={() => playback.setPlaying(true)}
          onPause={() => playback.setPlaying(false)}
          onEnded={() => playback.setPlaying(false)}
          onError={() =>
            playback.setAudioError(
              'The song audio could not play. Try loading it again.',
            )
          }
        />
      )}
      <div className="song-transport">
        <div className="song-transport-buttons">
          <button
            className="play-btn"
            disabled={!playback.ready}
            onClick={() => (clock.playing ? clock.pause() : clock.play())}
          >
            {clock.playing ? 'Pause song' : 'Play song'}
          </button>
          <button
            className="quiet-btn"
            disabled={!playback.ready}
            onClick={() => clock.seek(Math.max(0, position - 10))}
          >
            Back 10s
          </button>
          <label className="song-speed">
            Speed{' '}
            <select
              aria-label="Playback speed"
              value={speed}
              disabled={!playback.ready}
              onChange={(event) => {
                setSpeed(event.target.value)
                clock.setRate(Number(event.target.value))
              }}
            >
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
            </select>
          </label>
        </div>
        <div className="song-seek">
          <span>{timestamp(position)}</span>
          <input
            type="range"
            aria-label="Song position"
            min={0}
            max={Math.max(duration, 1)}
            step={0.1}
            value={Math.min(position, Math.max(duration, 1))}
            disabled={!playback.ready || !duration}
            onChange={(event) => clock.seek(Number(event.target.value))}
          />
          <span>{timestamp(duration)}</span>
        </div>
      </div>
      <div className="song-playback-links">
        {!useAudio && (
          <button onClick={playback.chooseAudio}>
            Video won’t play? Use song audio
          </button>
        )}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener"
        >
          Watch on YouTube
        </a>
      </div>
    </section>
  )
}
