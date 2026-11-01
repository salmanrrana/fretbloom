// Local AudioWorklet globals, used only to check the standalone worklet source.
interface AudioWorkletProcessorInstance {
  readonly port: MessagePort
}
declare const AudioWorkletProcessor: { new (): AudioWorkletProcessorInstance }
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessorInstance,
): void
declare const sampleRate: number
