import { createRoot } from 'react-dom/client'
import { SongbookMode } from '../../../src/components/SongbookMode'
import '../../../src/index.css'

// The real Songbook parent: editor save, player handoff, Back and reopen.
createRoot(document.getElementById('root')!).render(
  <SongbookMode onGlow={() => {}} />,
)
