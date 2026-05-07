import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Prospects from "./pages/Prospects";
import ProspectDetail from "./pages/ProspectDetail";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <Routes>
      {/* Public route – no Layout wrapping */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes – wrapped in Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/prospects" element={<Prospects />} />
          <Route path="/prospects/:id" element={<ProspectDetail />} />
          <Route path="/upload" element={<Upload />} />
        </Route>
      </Route>
    </Routes>
  );
}
