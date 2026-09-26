import { analyzeSamples } from './songAnalysis'

import type { SongAnalysis } from './songAnalysisTypes'

interface AnalyzeRequest {
  type: 'analyze'
  samples: ArrayBuffer
  sampleRate: number
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<AnalyzeRequest>) => void) | null
  postMessage(
    message:
      | { type: 'progress'; progress: number }
      | { type: 'result'; analysis: SongAnalysis }
      | { type: 'error'; message: string },
  ): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  if (event.data.type !== 'analyze') return
  try {
    const analysis = analyzeSamples(
      new Float32Array(event.data.samples),
      event.data.sampleRate,
      {
        onProgress: (progress) =>
          scope.postMessage({ type: 'progress', progress }),
      },
    )
    scope.postMessage({ type: 'result', analysis })
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'The recording could not be analyzed.',
    })
  }
}
