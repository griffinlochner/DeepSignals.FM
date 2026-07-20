import EnvironmentLabPage from "./experiments/environment-lab/EnvironmentLabPage";
import LandingPage from "./pages/LandingPage";
import PlayerPage from "./pages/PlayerPage";

function App() {
  const pathname = window.location.pathname;

  if (
    pathname === "/experiments/environment-lab" ||
    pathname === "/experiments/depth-lab"
  ) {
    return <EnvironmentLabPage />;
  }

  if (pathname === "/player") {
    return <PlayerPage />;
  }

  return <LandingPage />;
}

export default App;
