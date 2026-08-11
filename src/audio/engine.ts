import { MicInput } from './mic'
import { SongPlayer } from './player'

/**
 * One AudioContext for the whole app, created lazily on first user gesture
 * (browsers block audio before interaction). Player and mic share it.
 */
class Engine {
  private _ctx: AudioContext | null = null
  private _player: SongPlayer | null = null
  private _mic: MicInput | null = null

  get ctx(): AudioContext {
    if (!this._ctx) this._ctx = new AudioContext()
    if (this._ctx.state === 'suspended') void this._ctx.resume()
    return this._ctx
  }

  get player(): SongPlayer {
    if (!this._player) this._player = new SongPlayer(this.ctx)
    return this._player
  }

  get mic(): MicInput {
    if (!this._mic) this._mic = new MicInput(this.ctx)
    return this._mic
  }
}

export const engine = new Engine()
