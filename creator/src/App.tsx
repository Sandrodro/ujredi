import { useState } from 'react'
import { Home } from './pages/Home'
import { MakeCrossword } from './pages/MakeCrossword'
import { OpenCrossword } from './pages/OpenCrossword'
import type { Puzzle } from './puzzle/types'

type Screen = { name: 'home' } | { name: 'create' } | { name: 'open'; puzzle: Puzzle }

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const goHome = () => setScreen({ name: 'home' })

  switch (screen.name) {
    case 'create':
      return <MakeCrossword onHome={goHome} />
    case 'open':
      return <OpenCrossword puzzle={screen.puzzle} onHome={goHome} />
    default:
      return <Home onCreate={() => setScreen({ name: 'create' })} onOpen={(puzzle) => setScreen({ name: 'open', puzzle })} />
  }
}

export default App
