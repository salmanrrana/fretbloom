import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SongbookPlayer } from '../../src/components/SongbookPlayer'
import { parseTab } from '../../src/data/tabParser'
import type { SavedSong } from '../../src/data/songbook'
import '../../src/index.css'

const rawTab = 'e|--5--|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|'
const initialSong: SavedSong = {
  id: 'regression-song',
  title: 'Single A4',
  savedAt: 1,
  revision: 1,
  rawTab,
  steps: parseTab(rawTab).steps,
  youtubeId: null,
  syncTimes: [0],
  syncSource: 'manual',
}

function recording(hz: number, floating = false): File {
  const samples = 5 * 24000
  const width = floating ? 4 : 2
  const bytes = new ArrayBuffer(44 + samples * width)
  const v = new DataView(bytes)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      v.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  v.setUint32(4, bytes.byteLength - 8, true)
  text(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, floating ? 3 : 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 24000, true)
  v.setUint32(28, 24000 * width, true)
  v.setUint16(32, width, true)
  v.setUint16(34, width * 8, true)
  text(36, 'data')
  v.setUint32(40, samples * width, true)
  for (let i = 0; i < samples; i++) {
    const value =
      i < 6000 || i >= samples - 6000
        ? 0
        : Math.sin((2 * Math.PI * hz * i) / 24000) * (floating ? 2 : 8000)
    if (floating) v.setFloat32(44 + i * width, value, true)
    else v.setInt16(44 + i * width, value, true)
  }
  return new File([bytes], 'same-name.wav', { type: 'audio/wav' })
}

// Mount the actual player at the editor handoff: saved song plus optional file.
function Harness() {
  const [song, setSong] = useState(initialSong)
  const [file, setFile] = useState<File | undefined>(() => recording(440))
  const [generation, setGeneration] = useState(0)
  function reopen(replacement: boolean) {
    setFile(replacement ? recording(880) : undefined)
    setGeneration((n) => n + 1)
  }
  return (
    <>
      <button onClick={() => reopen(false)}>Reopen saved song</button>
      <button onClick={() => reopen(true)}>Open editor replacement</button>
      <button
        onClick={() => {
          setFile(recording(440, true))
          setGeneration((n) => n + 1)
        }}
      >
        Open clipped float recording
      </button>
      <output id="saved-state" hidden>
        {JSON.stringify(song)}
      </output>
      <SongbookPlayer
        key={generation}
        song={song}
        initialFile={file}
        onBack={() => {}}
        onEdit={() => {}}
        onGlow={() => {}}
        onUpdate={(changes) =>
          setSong((current) => ({ ...current, ...changes }))
        }
      />
    </>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
