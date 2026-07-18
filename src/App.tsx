import DepthPanoramaExperiment from './experiments/depth-panorama/DepthPanoramaExperiment'
import LandingPage from './pages/LandingPage'
import PlayerPage from './pages/PlayerPage'

function App() {
  const pathname = window.location.pathname

  if (pathname === '/experiments/depth-panorama') {
    return <DepthPanoramaExperiment />
  }

  if (pathname === '/player') {
    return <PlayerPage />
  }

  return <LandingPage />
}

export default App
