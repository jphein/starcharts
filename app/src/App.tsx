import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./design/theme";
import { Placeholder } from "./components/Placeholder";

import SignIn from "./screens/SignIn";
import ProfileSetup from "./screens/ProfileSetup";
import GroupSetup from "./screens/GroupSetup";
import Dashboard from "./screens/Dashboard";
import CreateChart from "./screens/CreateChart";
import ChartSky from "./screens/ChartSky";
import GiftFlow from "./screens/GiftFlow";
import SummonFlow from "./screens/SummonFlow";
import GoalReached from "./screens/GoalReached";
import ConstellationMemory from "./screens/ConstellationMemory";
import SkyTest from "./screens/SkyTest";

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/sign-in" replace />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/group-setup" element={<GroupSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/charts/new" element={<CreateChart />} />
          <Route path="/charts/:id" element={<ChartSky />} />
          <Route path="/charts/:id/give" element={<GiftFlow />} />
          <Route path="/charts/:id/summon" element={<SummonFlow />} />
          <Route path="/charts/:id/celebrate" element={<GoalReached />} />
          <Route path="/charts/:id/memory" element={<ConstellationMemory />} />
          <Route path="/sky-test" element={<SkyTest />} />
          <Route path="*" element={<Placeholder name="Lost in the sky" hint="no route matches" />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
