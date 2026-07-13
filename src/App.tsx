import LandingPage from './pages/LandingPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  const pathname = window.location.pathname

  if (pathname === '/player') {
    return <PlayerPage />
  }

  return <LandingPage />
}

export default App