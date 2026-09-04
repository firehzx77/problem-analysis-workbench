import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { HomePage } from "@/app/HomePage";
import { SettingsPage } from "@/app/SettingsPage";
import { WorkspacePage } from "@/app/workspace/WorkspacePage";

export function App() {
  return (
    <>
      <HashPathRedirect />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/case/:caseId" element={<WorkspacePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

function HashPathRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#/")) return;
    const next = hash.slice(1);
    if (next && next !== location.pathname + location.search) {
      navigate(next, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
