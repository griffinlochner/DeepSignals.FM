import EnvironmentLabPage from "./experiments/environment-lab/EnvironmentLabPage";
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

  if (pathname === "/player") {
    return <PlayerPage />;
  }

  return <LandingPage />;
}

export default App;
