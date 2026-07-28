import EnvironmentLabPage from "./experiments/environment-lab/EnvironmentLabPage";
import ExternalRadioProbePage from "./experiments/external-radio-probe/ExternalRadioProbePage";
import ReactivityLabPage from "./experiments/reactivity-lab/ReactivityLabPage";
import RadioPlayerPage from "./experiments/radio-player/RadioPlayerPage";
import LandingPage from "./pages/LandingPage";
import PlayerPage from "./pages/PlayerPage";

function normalizePathname(pathname: string) {
  const withoutIndexHtml = pathname.endsWith("/index.html")
    ? pathname.slice(0, -"/index.html".length)
    : pathname;

  if (withoutIndexHtml.length > 1 && withoutIndexHtml.endsWith("/")) {
    return withoutIndexHtml.slice(0, -1);
  }

  return withoutIndexHtml || "/";
}

function App() {
  const pathname = normalizePathname(window.location.pathname);

  if (pathname === "/experiments/environment-lab") {
    return <EnvironmentLabPage />;
  }

  if (pathname === "/experiments/external-radio-probe") {
    return import.meta.env.DEV ? <ExternalRadioProbePage /> : <LandingPage />;
  }

  if (pathname === "/experiments/radio-player") {
    return import.meta.env.DEV ? <RadioPlayerPage /> : <LandingPage />;
  }

  if (pathname === "/experiments/reactivity-lab") {
    return import.meta.env.DEV ? <ReactivityLabPage /> : <LandingPage />;
  }

  if (pathname === "/player") {
    return <PlayerPage />;
  }

  return <LandingPage />;
}

export default App;
