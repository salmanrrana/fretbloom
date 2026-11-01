import {
  AudioAnalysisPanel,
  type AudioAnalysisProps,
} from './AudioAnalysisPanel'

/** YouTube uses the same Rust job and playback timeline as uploads. */
export function YouTubeAnalysisPanel(
  props: AudioAnalysisProps & { videoId: string },
) {
  return (
    <>
      <AudioAnalysisPanel {...props} />
      <p>
        Can’t fetch this video’s audio?{' '}
        <a href={`/listen?video=${encodeURIComponent(props.videoId)}`}>
          Open Listen and explicitly share its tab audio
        </a>
        . Your browser will ask which tab to share; enable audio.
      </p>
    </>
  )
}
