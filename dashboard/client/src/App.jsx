import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Overview from "./pages/Overview.jsx";
import CodebaseExplanation from "./pages/CodebaseExplanation.jsx";
import MigrationPlan from "./pages/MigrationPlan.jsx";
import SecurityFindings from "./pages/SecurityFindings.jsx";
import DependencyGraph from "./pages/DependencyGraph.jsx";
import ModernizedSamples from "./pages/ModernizedSamples.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="codebase" element={<CodebaseExplanation />} />
          <Route path="migration" element={<MigrationPlan />} />
          <Route path="security" element={<SecurityFindings />} />
          <Route path="dependency-graph" element={<DependencyGraph />} />
          <Route path="samples" element={<ModernizedSamples />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
