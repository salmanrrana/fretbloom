import { checkPcmIntegrity } from './pcmIntegrity'

// One request per worker. The caller terminates it on every outcome, including timeout/cancel.
self.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    await checkPcmIntegrity(event.data)
    self.postMessage({ ok: true })
  } catch (error) {
    self.postMessage({
      ok: false,
      message:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : 'Audio verification failed.',
    })
  }
}
