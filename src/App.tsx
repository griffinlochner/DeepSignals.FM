import ReactivityLabPage from "./experiments/reactivity-lab/ReactivityLabPage";
import AboutPage from "./pages/AboutPage";
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

  if (pathname === "/experiments/reactivity-lab") {
    return import.meta.env.DEV ? <ReactivityLabPage /> : <LandingPage />;
  }

  if (pathname === "/player") {
    return <PlayerPage />;
  }

  if (pathname === "/about") {
    return <AboutPage />;
  }

  return <LandingPage />;
}

export default App;
