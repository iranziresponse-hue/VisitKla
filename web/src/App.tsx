import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WorldPage } from "./pages/WorldPage";
import { RouteChoicePage } from "./pages/RouteChoicePage";
import { RoutePreviewPage } from "./pages/RoutePreviewPage";
import { NavigationPage } from "./pages/NavigationPage";
import { RidePage } from "./pages/RidePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorldPage />} />
        <Route path="/plan" element={<RouteChoicePage />} />
        <Route path="/route/:routeId" element={<RoutePreviewPage />} />
        <Route path="/route/:routeId/ride" element={<RidePage />} />
        <Route path="/route/:routeId/ride/:mode" element={<RidePage />} />
        <Route
          path="/route/:routeId/navigate/:mode"
          element={<NavigationPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
